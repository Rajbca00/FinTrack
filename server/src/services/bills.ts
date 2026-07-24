import { addWeeks, addMonths, addQuarters, addYears, startOfDay, endOfDay, endOfWeek, endOfMonth } from "date-fns";
import { prisma } from "../lib/prisma";
import type { Bill } from "@prisma/client";

function advance(date: Date, recurrence: string): Date {
  if (recurrence === "WEEKLY") return addWeeks(date, 1);
  if (recurrence === "QUARTERLY") return addQuarters(date, 1);
  if (recurrence === "YEARLY") return addYears(date, 1);
  return addMonths(date, 1);
}

// Keeps nextDueDate meaningful without a cron: if it's already in the past,
// roll it forward one recurrence interval at a time until it's upcoming
// again, persisting the result. Mirrors the snapshot-on-read pattern used
// for NetWorthSnapshot.
export async function rollForwardBills(bills: Bill[]): Promise<Bill[]> {
  const today = startOfDay(new Date());
  const updated: Bill[] = [];
  for (const bill of bills) {
    let due = bill.nextDueDate;
    let changed = false;
    while (due < today) {
      due = advance(due, bill.recurrence);
      changed = true;
    }
    if (changed) {
      updated.push(await prisma.bill.update({ where: { id: bill.id }, data: { nextDueDate: due } }));
    } else {
      updated.push(bill);
    }
  }
  return updated;
}

export function groupBillsByWindow(bills: Bill[]) {
  const now = new Date();
  const todayEnd = endOfDay(now);
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthEnd = endOfMonth(now);

  const dueToday: Bill[] = [];
  const dueThisWeek: Bill[] = [];
  const dueThisMonth: Bill[] = [];
  const later: Bill[] = [];

  for (const bill of bills) {
    if (bill.nextDueDate <= todayEnd) dueToday.push(bill);
    else if (bill.nextDueDate <= weekEnd) dueThisWeek.push(bill);
    else if (bill.nextDueDate <= monthEnd) dueThisMonth.push(bill);
    else later.push(bill);
  }

  return { dueToday, dueThisWeek, dueThisMonth, later };
}

// Scans expense transactions for descriptions that recur across multiple
// distinct months at a similar amount (within 15%) - a reasonable proxy for
// "this looks like a recurring bill" without needing merchant-ID data the
// app doesn't have. Excludes descriptions that already match an active
// Bill's name so re-running suggestions doesn't just re-suggest what's
// already tracked.
export async function suggestBills(limit = 10) {
  const [transactions, existingBills] = await Promise.all([
    prisma.transaction.findMany({
      where: { amount: { lt: 0 }, isTransfer: false },
      select: { description: true, amount: true, date: true, categoryId: true },
      orderBy: { date: "desc" },
      take: 2000,
    }),
    prisma.bill.findMany({ where: { archived: false }, select: { name: true } }),
  ]);

  const existingNames = new Set(existingBills.map((b) => b.name.toLowerCase().trim()));

  const groups = new Map<string, { description: string; amounts: number[]; months: Set<string>; categoryId: string | null; lastDate: Date }>();
  for (const t of transactions) {
    const key = t.description.trim().toLowerCase();
    if (!key || existingNames.has(key)) continue;
    const monthKey = `${t.date.getUTCFullYear()}-${t.date.getUTCMonth()}`;
    const entry = groups.get(key) ?? { description: t.description.trim(), amounts: [], months: new Set(), categoryId: t.categoryId, lastDate: t.date };
    entry.amounts.push(Math.abs(t.amount));
    entry.months.add(monthKey);
    if (t.date > entry.lastDate) entry.lastDate = t.date;
    groups.set(key, entry);
  }

  const candidates = Array.from(groups.values())
    .filter((g) => g.months.size >= 2)
    .filter((g) => {
      const avg = g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length;
      return g.amounts.every((a) => Math.abs(a - avg) / avg <= 0.15);
    })
    .map((g) => {
      const avg = g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length;
      return {
        description: g.description,
        amount: Math.round(avg * 100) / 100,
        occurrences: g.months.size,
        categoryId: g.categoryId,
        suggestedNextDueDate: addMonths(g.lastDate, 1).toISOString(),
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, limit);

  return candidates;
}
