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

  // "uncategorized" is a client-side sentinel for categoryId: null (the
  // real "no category" state - see categorize()'s null return), not an
  // actual category id, since ids are cuids and never collide with it.
  const where = {
    accountId,
    groupId,
    categoryId: categoryId === "uncategorized" ? null : categoryId,
    date: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    description: q ? { contains: q } : undefined,
  };

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { category: true, group: true, account: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // A running balance is only well-defined when scoped to a single group
  // (mixing groups/accounts has no one coherent balance to run), and needs
  // every one of that group's transactions - not just this page - to add up
  // correctly, so it's computed from a separate, unpaginated query.
  let runningBalances: Record<string, number> | undefined;
  if (groupId) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (group) {
      const allInGroup = await prisma.transaction.findMany({
        where: { groupId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { id: true, amount: true },
      });
      runningBalances = {};
      let running = group.openingBalance;
      for (const t of allInGroup) {
        running += t.amount;
        runningBalances[t.id] = running;
      }
    }
  }

  res.json({ total, page, pageSize, transactions, runningBalances });
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
  accountId: z.string().optional(),
  groupId: z.string().optional(),
  notes: z.string().optional().nullable(),
});

transactionsRouter.put("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { date, accountId, groupId, ...rest } = parsed.data;

  const existing = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });

  // A transfer leg's account is locked - moving it here would desync it from
  // its paired leg, so that stays on the Transfers view (same rule as delete).
  if (existing.isTransfer && accountId && accountId !== existing.accountId) {
    return res.status(400).json({ error: "Edit this from the Transfers view so both legs stay in sync" });
  }

  // Moving to a different account without an explicit group falls back to
  // that account's default group, since the current groupId won't belong to it.
  let resolvedGroupId = groupId;
  if (accountId && accountId !== existing.accountId) {
    if (groupId) {
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group || group.accountId !== accountId) {
        return res.status(400).json({ error: "Group does not belong to the selected account" });
      }
    } else {
      const defaultGroup = await prisma.group.findFirst({ where: { accountId, isDefault: true } });
      if (!defaultGroup) return res.status(400).json({ error: "Selected account has no default group" });
      resolvedGroupId = defaultGroup.id;
    }
  }

  const transaction = await prisma.transaction.update({
    where: { id: req.params.id },
    data: { ...rest, accountId, groupId: resolvedGroupId, date: date ? new Date(date) : undefined },
    include: { category: true, group: true, account: true },
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

const bulkMoveGroupSchema = z.object({
  transactionIds: z.array(z.string()).min(1),
  groupId: z.string().min(1),
});

transactionsRouter.post("/bulk-move-group", async (req, res) => {
  const parsed = bulkMoveGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { count } = await prisma.transaction.updateMany({
    where: { id: { in: parsed.data.transactionIds } },
    data: { groupId: parsed.data.groupId },
  });
  res.json({ updated: count });
});

const bulkDeleteSchema = z.object({
  transactionIds: z.array(z.string()).min(1),
});

transactionsRouter.post("/bulk-delete", async (req, res) => {
  const parsed = bulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  // Transfers are excluded (same rule as the single-delete endpoint) so a bulk
  // delete can't silently break a transfer's paired leg - delete those from
  // the Transfers view instead.
  const { count } = await prisma.transaction.deleteMany({
    where: { id: { in: parsed.data.transactionIds }, isTransfer: false },
  });
  res.json({ deleted: count });
});
