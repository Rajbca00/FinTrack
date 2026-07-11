import { startOfWeek, startOfMonth, startOfYear, format } from "date-fns";
import { prisma } from "../lib/prisma";

export type Period = "week" | "month" | "year";

export type TrendFilters = {
  period: Period;
  from?: Date;
  to?: Date;
  accountId?: string;
  groupId?: string;
};

function bucketKey(date: Date, period: Period): { key: string; label: string } {
  if (period === "week") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    return { key: format(start, "yyyy-MM-dd"), label: `Week of ${format(start, "MMM d, yyyy")}` };
  }
  if (period === "year") {
    const start = startOfYear(date);
    return { key: format(start, "yyyy"), label: format(start, "yyyy") };
  }
  const start = startOfMonth(date);
  return { key: format(start, "yyyy-MM"), label: format(start, "MMM yyyy") };
}

async function fetchTransactions(filters: { from?: Date; to?: Date; accountId?: string; groupId?: string }) {
  return prisma.transaction.findMany({
    where: {
      date: {
        gte: filters.from,
        lte: filters.to,
      },
      accountId: filters.accountId,
      groupId: filters.groupId,
    },
    include: { category: true },
    orderBy: { date: "asc" },
  });
}

function isRealIncomeExpense(categoryType: string | undefined, isTransfer: boolean): boolean {
  return !isTransfer && categoryType !== "TRANSFER";
}

export async function getTrend(filters: TrendFilters) {
  const txns = await fetchTransactions(filters);
  const buckets = new Map<string, { key: string; label: string; income: number; expense: number }>();

  for (const t of txns) {
    if (!isRealIncomeExpense(t.category?.type, t.isTransfer)) continue;
    const { key, label } = bucketKey(t.date, filters.period);
    if (!buckets.has(key)) buckets.set(key, { key, label, income: 0, expense: 0 });
    const b = buckets.get(key)!;
    if (t.amount >= 0) b.income += t.amount;
    else b.expense += Math.abs(t.amount);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => ({ ...b, net: b.income - b.expense }));
}

export async function getCategoryBreakdown(filters: { from?: Date; to?: Date; accountId?: string; groupId?: string; type?: "INCOME" | "EXPENSE" }) {
  const txns = await fetchTransactions(filters);
  const wantType = filters.type ?? "EXPENSE";
  const totals = new Map<string, { categoryId: string; name: string; color: string | null; total: number }>();

  for (const t of txns) {
    if (!isRealIncomeExpense(t.category?.type, t.isTransfer)) continue;
    const sign = t.amount >= 0 ? "INCOME" : "EXPENSE";
    if (sign !== wantType) continue;
    const categoryId = t.categoryId ?? "uncategorized";
    const name = t.category?.name ?? "Uncategorized";
    const color = t.category?.color ?? "#64748b";
    if (!totals.has(categoryId)) totals.set(categoryId, { categoryId, name, color, total: 0 });
    totals.get(categoryId)!.total += Math.abs(t.amount);
  }

  return Array.from(totals.values()).sort((a, b) => b.total - a.total);
}

export async function getBalances() {
  const accounts = await prisma.account.findMany({
    where: { archived: false },
    include: {
      groups: {
        where: { archived: false },
        include: { _count: { select: { transactions: true } } },
      },
    },
  });

  const results = [];
  for (const account of accounts) {
    const groupResults = [];
    let accountBalance = 0;
    for (const group of account.groups) {
      const agg = await prisma.transaction.aggregate({
        where: { groupId: group.id },
        _sum: { amount: true },
      });
      const balance = group.openingBalance + (agg._sum.amount ?? 0);
      accountBalance += balance;
      groupResults.push({
        id: group.id,
        name: group.name,
        color: group.color,
        isDefault: group.isDefault,
        openingBalance: group.openingBalance,
        balance,
        transactionCount: group._count.transactions,
      });
    }
    results.push({
      id: account.id,
      name: account.name,
      type: account.type,
      institution: account.institution,
      last4: account.last4,
      currency: account.currency,
      creditLimit: account.creditLimit,
      isMultiPurpose: account.isMultiPurpose,
      balance: accountBalance,
      groups: groupResults,
    });
  }
  return results;
}
