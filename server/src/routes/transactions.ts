import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { categorize } from "../services/rulesEngine";
import { findSimilarTransactions } from "../services/merchants";

export const transactionsRouter = Router();

const listQuerySchema = z.object({
  accountId: z.string().optional(),
  groupId: z.string().optional(),
  categoryId: z.string().optional(),
  bucketId: z.string().optional(),
  isNonBudget: z.coerce.boolean().optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  // Applied to the amount's magnitude (not the signed value) so "above 1000"
  // matches an expense of -1500 as well as an income of 1500 - see the
  // natural-language search parser on the client, which is the only caller
  // that currently sets these.
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(200).default(50),
});

transactionsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { accountId, groupId, categoryId, bucketId, isNonBudget, type, from, to, q, minAmount, maxAmount, page, pageSize } = parsed.data;

  // "uncategorized" is a client-side sentinel for categoryId: null (the
  // real "no category" state - see categorize()'s null return), not an
  // actual category id, since ids are cuids and never collide with it.
  // type=INCOME/EXPENSE filters by amount sign and excludes transfer legs,
  // matching the "real income/expense" convention used in summary.ts.
  const where = {
    accountId,
    groupId,
    categoryId: categoryId === "uncategorized" ? null : categoryId,
    bucketId,
    isNonBudget,
    ...(type ? { isTransfer: false, amount: type === "INCOME" ? { gte: 0 } : { lt: 0 } } : {}),
    date: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    description: q ? { contains: q, mode: "insensitive" as const } : undefined,
    ...(minAmount !== undefined ? { OR: [{ amount: { gte: minAmount } }, { amount: { lte: -minAmount } }] } : {}),
    ...(maxAmount !== undefined ? { amount: { gte: -maxAmount, lte: maxAmount } } : {}),
  };

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { category: true, group: true, account: true, bucket: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // A running balance is only well-defined when scoped to a single group or
  // a single account (mixing multiple accounts has no one coherent balance
  // to run), and needs every one of that scope's transactions - not just
  // this page - to add up correctly, so it's computed from a separate,
  // unpaginated query. Account-scoped (no specific group) sums every
  // group's opening balance and every transaction across the account, so
  // viewing "all groups" on an account still gets a real running balance
  // instead of requiring one group to be picked.
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
  } else if (accountId) {
    const groups = await prisma.group.findMany({ where: { accountId } });
    if (groups.length > 0) {
      const allInAccount = await prisma.transaction.findMany({
        where: { accountId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { id: true, amount: true },
      });
      runningBalances = {};
      let running = groups.reduce((sum, g) => sum + g.openingBalance, 0);
      for (const t of allInAccount) {
        running += t.amount;
        runningBalances[t.id] = running;
      }
    }
  }

  res.json({ total, page, pageSize, transactions, runningBalances });
});

transactionsRouter.get("/:id/similar", async (req, res) => {
  const targetCategoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
  if (!targetCategoryId) return res.status(400).json({ error: "categoryId query param is required" });

  const transaction = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (!transaction) return res.status(404).json({ error: "Transaction not found" });

  const similar = await findSimilarTransactions({
    transactionId: transaction.id,
    description: transaction.description,
    targetCategoryId,
  });
  res.json({ count: similar.length, transactions: similar });
});

const createSchema = z.object({
  accountId: z.string().min(1),
  groupId: z.string().min(1),
  date: z.string(),
  description: z.string().min(1),
  amount: z.number(),
  categoryId: z.string().optional().nullable(),
  bucketId: z.string().optional().nullable(),
  isNonBudget: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

transactionsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  const ruleMatch = data.categoryId ? null : await categorize({ description: data.description, amount: data.amount });
  const categoryId = data.categoryId ?? ruleMatch?.categoryId ?? null;
  // Never overwrite notes the user actually typed into the add-transaction
  // form - only fall back to the rule's template when they left it blank.
  const notes = data.notes ?? ruleMatch?.notes ?? null;

  const transaction = await prisma.transaction.create({
    data: { ...data, date: new Date(data.date), categoryId, notes },
    include: { category: true, group: true, bucket: true },
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
  bucketId: z.string().optional().nullable(),
  isNonBudget: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

transactionsRouter.put("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { date, accountId, groupId, categoryId, ...rest } = parsed.data;

  const existing = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });

  // A transfer leg's account/date/category are locked - changing any of them
  // here would desync it from its paired leg (a different date/category on
  // each row of the same transfer, or a moved account with an unmoved
  // counterpart), so those stay on the Transfers view (same rule as delete).
  // Amount and group are also client-disabled for the same reason, but are
  // allowed through here since they aren't structurally paired the same way
  // (group is per-leg by design, and Transfers already recomputes amount
  // signs itself).
  if (existing.isTransfer) {
    if (accountId && accountId !== existing.accountId) {
      return res.status(400).json({ error: "Edit this from the Transfers view so both legs stay in sync" });
    }
    if (date && new Date(date).getTime() !== existing.date.getTime()) {
      return res.status(400).json({ error: "Edit this from the Transfers view so both legs stay in sync" });
    }
    if (categoryId !== undefined && categoryId !== existing.categoryId) {
      return res.status(400).json({ error: "Edit this from the Transfers view so both legs stay in sync" });
    }
  }

  // Whichever account this transaction will belong to once this update
  // applies - a provided groupId must always belong to THIS account, not
  // just to `existing.accountId`, or a request that sends groupId without
  // also sending accountId could silently attach a group from a completely
  // different account (corrupting both accounts' balances) with no check
  // at all, since the old code below only validated groupId when accountId
  // was *also* present and different.
  const effectiveAccountId = accountId ?? existing.accountId;
  let resolvedGroupId = groupId;
  if (groupId) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.accountId !== effectiveAccountId) {
      return res.status(400).json({ error: "Group does not belong to the selected account" });
    }
  } else if (accountId && accountId !== existing.accountId) {
    // Moving to a different account without an explicit group falls back to
    // that account's default group, since the current groupId won't belong to it.
    const defaultGroup = await prisma.group.findFirst({ where: { accountId, isDefault: true } });
    if (!defaultGroup) return res.status(400).json({ error: "Selected account has no default group" });
    resolvedGroupId = defaultGroup.id;
  }

  const transaction = await prisma.transaction.update({
    where: { id: req.params.id },
    data: { ...rest, categoryId, accountId, groupId: resolvedGroupId, date: date ? new Date(date) : undefined },
    include: { category: true, group: true, account: true, bucket: true },
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
  const group = await prisma.group.findUnique({ where: { id: parsed.data.groupId } });
  if (!group) return res.status(400).json({ error: "Group not found" });
  // Constrained to transactions that already belong to this group's account
  // - selecting a group in one account's row from a cross-account transaction
  // list must never silently reassign a different account's transaction to
  // it, which would desync that transaction's accountId from its own group.
  const { count } = await prisma.transaction.updateMany({
    where: { id: { in: parsed.data.transactionIds }, accountId: group.accountId },
    data: { groupId: parsed.data.groupId },
  });
  res.json({ updated: count, requested: parsed.data.transactionIds.length });
});

const bulkMoveBucketSchema = z.object({
  transactionIds: z.array(z.string()).min(1),
  bucketId: z.string().nullable(),
});

transactionsRouter.post("/bulk-move-bucket", async (req, res) => {
  const parsed = bulkMoveBucketSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { count } = await prisma.transaction.updateMany({
    where: { id: { in: parsed.data.transactionIds } },
    data: { bucketId: parsed.data.bucketId },
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
