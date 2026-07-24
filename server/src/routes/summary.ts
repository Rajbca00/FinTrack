import { Router } from "express";
import { z } from "zod";
import { getTrend, getCategoryBreakdown, getCategoryMonthlyBreakdown, getBalances } from "../services/summary";
import { computeNetWorth, recordSnapshot, getNetWorthTrend } from "../services/netWorth";

export const summaryRouter = Router();

const filterSchema = z.object({
  period: z.enum(["week", "month", "year"]).default("month"),
  from: z.string().optional(),
  to: z.string().optional(),
  accountId: z.string().optional(),
  // Array form filters by every group matching a set of ids at once - used
  // by the Dashboard's group-name filter to span every account sharing a
  // group name (e.g. "General"), since a name isn't one id.
  groupId: z.union([z.string(), z.array(z.string())]).optional(),
});

summaryRouter.get("/trend", async (req, res) => {
  const parsed = filterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { period, from, to, accountId, groupId } = parsed.data;
  const trend = await getTrend({
    period,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    accountId,
    groupId,
  });
  res.json(trend);
});

const breakdownSchema = filterSchema.extend({ type: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE") });

summaryRouter.get("/breakdown", async (req, res) => {
  const parsed = breakdownSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { from, to, accountId, groupId, type } = parsed.data;
  const breakdown = await getCategoryBreakdown({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    accountId,
    groupId,
    type,
  });
  res.json(breakdown);
});

summaryRouter.get("/category-trend", async (req, res) => {
  const parsed = breakdownSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { from, to, accountId, groupId, type } = parsed.data;
  const result = await getCategoryMonthlyBreakdown({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    accountId,
    groupId,
    type,
  });
  res.json(result);
});

summaryRouter.get("/balances", async (_req, res) => {
  const balances = await getBalances();
  res.json(balances);
});

summaryRouter.get("/net-worth", async (_req, res) => {
  const breakdown = await computeNetWorth();
  await recordSnapshot(breakdown);
  res.json(breakdown);
});

summaryRouter.get("/net-worth/trend", async (_req, res) => {
  const trend = await getNetWorthTrend();
  res.json(trend);
});
