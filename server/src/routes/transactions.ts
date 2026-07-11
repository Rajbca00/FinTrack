import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { categorize } from "../services/rulesEngine";

export const transactionsRouter = Router();

const listQuerySchema = z.object({
  accountId: z.string().optional(),
  groupId: z.string().optional(),
  categoryId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(200).default(50),
});

transactionsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { accountId, groupId, categoryId, from, to, q, page, pageSize } = parsed.data;

  const where = {
    accountId,
    groupId,
    categoryId,
    date: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    description: q ? { contains: q } : undefined,
  };

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { category: true, group: true, account: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({ total, page, pageSize, transactions });
});

const createSchema = z.object({
  accountId: z.string().min(1),
  groupId: z.string().min(1),
  date: z.string(),
  description: z.string().min(1),
  amount: z.number(),
  categoryId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

transactionsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  const categoryId = data.categoryId ?? (await categorize({ description: data.description, amount: data.amount }));

  const transaction = await prisma.transaction.create({
    data: { ...data, date: new Date(data.date), categoryId },
    include: { category: true, group: true },
  });
  res.status(201).json(transaction);
});

const updateSchema = z.object({
  date: z.string().optional(),
  description: z.string().min(1).optional(),
  amount: z.number().optional(),
  categoryId: z.string().optional().nullable(),
  groupId: z.string().optional(),
  notes: z.string().optional().nullable(),
});

transactionsRouter.put("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { date, ...rest } = parsed.data;

  const transaction = await prisma.transaction.update({
    where: { id: req.params.id },
    data: { ...rest, date: date ? new Date(date) : undefined },
    include: { category: true, group: true },
  });
  res.json(transaction);
});

transactionsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (existing?.isTransfer) {
    return res.status(400).json({ error: "Delete this from the Transfers view so both legs stay in sync" });
  }
  await prisma.transaction.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

const bulkCategorizeSchema = z.object({
  transactionIds: z.array(z.string()).min(1),
  categoryId: z.string().min(1),
});

transactionsRouter.post("/bulk-categorize", async (req, res) => {
  const parsed = bulkCategorizeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { count } = await prisma.transaction.updateMany({
    where: { id: { in: parsed.data.transactionIds } },
    data: { categoryId: parsed.data.categoryId },
  });
  res.json({ updated: count });
});
