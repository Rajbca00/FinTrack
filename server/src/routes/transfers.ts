import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const transfersRouter = Router();

async function getTransferCategoryId(): Promise<string> {
  const category = await prisma.category.findUnique({ where: { name: "Internal Transfer" } });
  if (category) return category.id;
  const created = await prisma.category.create({
    data: { name: "Internal Transfer", type: "TRANSFER", color: "#64748b", isSystem: true },
  });
  return created.id;
}

transfersRouter.get("/", async (_req, res) => {
  const transfers = await prisma.transfer.findMany({
    include: {
      transactions: { include: { account: true, group: true } },
    },
    orderBy: { date: "desc" },
  });
  res.json(transfers);
});

// Moves real money between two accounts (e.g. savings -> credit card payment).
const accountTransferSchema = z.object({
  type: z.literal("ACCOUNT_TRANSFER"),
  date: z.string(),
  amount: z.number().positive(),
  note: z.string().optional().nullable(),
  fromAccountId: z.string().min(1),
  fromGroupId: z.string().min(1),
  toAccountId: z.string().min(1),
  toGroupId: z.string().min(1),
});

// Reallocates funds between two groups inside the SAME account -
// e.g. moving 5000 from "Personal" to "Temple Fund" within one ICICI account.
// Net zero at the account level, but shifts each group's balance.
const groupReallocationSchema = z.object({
  type: z.literal("GROUP_REALLOCATION"),
  date: z.string(),
  amount: z.number().positive(),
  note: z.string().optional().nullable(),
  accountId: z.string().min(1),
  fromGroupId: z.string().min(1),
  toGroupId: z.string().min(1),
});

const transferSchema = z.discriminatedUnion("type", [accountTransferSchema, groupReallocationSchema]);

transfersRouter.post("/", async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  const categoryId = await getTransferCategoryId();
  const date = new Date(data.date);

  if (data.type === "ACCOUNT_TRANSFER") {
    if (data.fromAccountId === data.toAccountId && data.fromGroupId === data.toGroupId) {
      return res.status(400).json({ error: "Source and destination must differ" });
    }
    const transfer = await prisma.transfer.create({
      data: {
        type: "ACCOUNT_TRANSFER",
        date,
        amount: data.amount,
        note: data.note,
        transactions: {
          create: [
            {
              accountId: data.fromAccountId,
              groupId: data.fromGroupId,
              date,
              description: data.note ? `Transfer out: ${data.note}` : "Transfer out",
              amount: -data.amount,
              categoryId,
              isTransfer: true,
            },
            {
              accountId: data.toAccountId,
              groupId: data.toGroupId,
              date,
              description: data.note ? `Transfer in: ${data.note}` : "Transfer in",
              amount: data.amount,
              categoryId,
              isTransfer: true,
            },
          ],
        },
      },
      include: { transactions: { include: { account: true, group: true } } },
    });
    return res.status(201).json(transfer);
  }

  // GROUP_REALLOCATION
  if (data.fromGroupId === data.toGroupId) {
    return res.status(400).json({ error: "Source and destination groups must differ" });
  }
  const [fromGroup, toGroup] = await Promise.all([
    prisma.group.findUnique({ where: { id: data.fromGroupId } }),
    prisma.group.findUnique({ where: { id: data.toGroupId } }),
  ]);
  if (!fromGroup || !toGroup || fromGroup.accountId !== data.accountId || toGroup.accountId !== data.accountId) {
    return res.status(400).json({ error: "Both groups must belong to the given account" });
  }

  const transfer = await prisma.transfer.create({
    data: {
      type: "GROUP_REALLOCATION",
      date,
      amount: data.amount,
      note: data.note,
      transactions: {
        create: [
          {
            accountId: data.accountId,
            groupId: data.fromGroupId,
            date,
            description: data.note ? `Reallocation out: ${data.note}` : `Reallocated to ${toGroup.name}`,
            amount: -data.amount,
            categoryId,
            isTransfer: true,
          },
          {
            accountId: data.accountId,
            groupId: data.toGroupId,
            date,
            description: data.note ? `Reallocation in: ${data.note}` : `Reallocated from ${fromGroup.name}`,
            amount: data.amount,
            categoryId,
            isTransfer: true,
          },
        ],
      },
    },
    include: { transactions: { include: { account: true, group: true } } },
  });
  res.status(201).json(transfer);
});

transfersRouter.delete("/:id", async (req, res) => {
  await prisma.transaction.deleteMany({ where: { transferId: req.params.id } });
  await prisma.transfer.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
