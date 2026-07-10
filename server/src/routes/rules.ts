import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { invalidateRuleCache, categorize } from "../services/rulesEngine";

export const rulesRouter = Router();

const ruleSchema = z.object({
  pattern: z.string().min(1),
  matchType: z.enum(["CONTAINS", "STARTS_WITH", "REGEX", "EXACT"]),
  categoryId: z.string().min(1),
  amountSign: z.enum(["ANY", "DEBIT", "CREDIT"]).default("ANY"),
  priority: z.number().default(0),
  isActive: z.boolean().default(true),
});

rulesRouter.get("/", async (_req, res) => {
  const rules = await prisma.categoryRule.findMany({
    include: { category: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  res.json(rules);
});

rulesRouter.post("/", async (req, res) => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const rule = await prisma.categoryRule.create({ data: parsed.data });
  invalidateRuleCache();
  res.status(201).json(rule);
});

rulesRouter.put("/:id", async (req, res) => {
  const parsed = ruleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const rule = await prisma.categoryRule.update({ where: { id: req.params.id }, data: parsed.data });
  invalidateRuleCache();
  res.json(rule);
});

rulesRouter.delete("/:id", async (req, res) => {
  await prisma.categoryRule.delete({ where: { id: req.params.id } });
  invalidateRuleCache();
  res.status(204).send();
});

// Re-run active rules against existing transactions.
// By default only fills in transactions that have no category yet;
// pass { overwrite: true } to re-categorize everything.
rulesRouter.post("/apply", async (req, res) => {
  const overwrite = req.body?.overwrite === true;
  const accountId = typeof req.body?.accountId === "string" ? req.body.accountId : undefined;

  invalidateRuleCache();
  const txns = await prisma.transaction.findMany({
    where: {
      accountId,
      isTransfer: false,
      ...(overwrite ? {} : { categoryId: null }),
    },
  });

  let updated = 0;
  for (const t of txns) {
    const categoryId = await categorize({ description: t.description, amount: t.amount });
    if (categoryId && categoryId !== t.categoryId) {
      await prisma.transaction.update({ where: { id: t.id }, data: { categoryId } });
      updated++;
    }
  }

  res.json({ scanned: txns.length, updated });
});
