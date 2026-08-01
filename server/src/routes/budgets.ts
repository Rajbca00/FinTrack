import { Router } from "express";
import { z } from "zod";
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, format } from "date-fns";
import { prisma } from "../lib/prisma";

export const budgetsRouter = Router();

const BUDGET_PERIODS = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;

const budgetSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number(),
  period: z.enum(BUDGET_PERIODS).default("MONTHLY"),
});

function currentPeriodRange(period: string, now = new Date()) {
  if (period === "QUARTERLY") return { from: startOfQuarter(now), to: endOfQuarter(now) };
  if (period === "YEARLY") return { from: startOfYear(now), to: endOfYear(now) };
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

async function withSpend<T extends { categoryId: string; period: string }>(budgets: T[]) {
  return Promise.all(
    budgets.map(async (b) => {
      const { from, to } = currentPeriodRange(b.period);
      const agg = await prisma.transaction.aggregate({
        where: { categoryId: b.categoryId, date: { gte: from, lte: to }, amount: { lt: 0 } },
        _sum: { amount: true },
      });
      const spent = Math.abs(agg._sum.amount ?? 0);
      return { ...b, spent, periodStart: from.toISOString(), periodEnd: to.toISOString() };
    })
  );
}

budgetsRouter.get("/", async (_req, res) => {
  const budgets = await prisma.budget.findMany({
    where: { archived: false },
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(await withSpend(budgets));
});

// Normalizes a budget's amount to a "per month" figure so quarterly/yearly
// budgets can be compared side-by-side with monthly ones on the trend chart.
function monthlyEquivalent(amount: number, period: string) {
  if (period === "QUARTERLY") return amount / 3;
  if (period === "YEARLY") return amount / 12;
  return amount;
}

// Month-on-month planned vs. actual for every currently active budget's
// category, over the last `months` calendar months. Budgets aren't
// versioned, so "planned" reuses each budget's *current* amount for every
// month in the window rather than reconstructing what it was set to at the
// time - a reasonable proxy for "how am I tracking against today's plan"
// rather than a literal historical record.
budgetsRouter.get("/monthly-trend", async (req, res) => {
  const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);

  const budgets = await prisma.budget.findMany({ where: { archived: false } });
  const totalPlanned = budgets.reduce((sum, b) => sum + monthlyEquivalent(b.amount, b.period), 0);

  if (budgets.length === 0) return res.json({ months: [], totalPlanned: 0 });

  const now = new Date();
  const rangeStart = startOfMonth(subMonths(now, months - 1));
  const categoryIds = Array.from(new Set(budgets.map((b) => b.categoryId)));

  const txns = await prisma.transaction.findMany({
    where: { categoryId: { in: categoryIds }, amount: { lt: 0 }, date: { gte: rangeStart, lte: endOfMonth(now) } },
    select: { amount: true, date: true },
  });

  const spentByMonth = new Map<string, number>();
  for (const t of txns) {
    const key = format(startOfMonth(t.date), "yyyy-MM");
    spentByMonth.set(key, (spentByMonth.get(key) ?? 0) + Math.abs(t.amount));
  }

  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    const key = format(startOfMonth(d), "yyyy-MM");
    result.push({ month: key, label: format(d, "MMM yyyy"), planned: totalPlanned, spent: spentByMonth.get(key) ?? 0 });
  }

  res.json({ months: result, totalPlanned });
});

budgetsRouter.post("/", async (req, res) => {
  const parsed = budgetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.budget.findFirst({ where: { categoryId: parsed.data.categoryId, archived: false } });
  if (existing) return res.status(400).json({ error: "This category already has an active budget" });

  const budget = await prisma.budget.create({ data: parsed.data, include: { category: true } });
  res.status(201).json((await withSpend([budget]))[0]);
});

budgetsRouter.put("/:id", async (req, res) => {
  const parsed = budgetSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const budget = await prisma.budget.update({ where: { id: req.params.id }, data: parsed.data, include: { category: true } });
  res.json((await withSpend([budget]))[0]);
});

budgetsRouter.delete("/:id", async (req, res) => {
  await prisma.budget.update({ where: { id: req.params.id }, data: { archived: true } });
  res.status(204).send();
});
