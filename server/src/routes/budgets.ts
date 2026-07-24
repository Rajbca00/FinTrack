import { Router } from "express";
import { z } from "zod";
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
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
