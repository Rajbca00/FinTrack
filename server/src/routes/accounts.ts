import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const accountsRouter = Router();

const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["BANK", "CREDIT_CARD"]),
  institution: z.string().optional().nullable(),
  last4: z.string().optional().nullable(),
  currency: z.string().default("INR"),
  creditLimit: z.number().optional().nullable(),
  openingBalance: z.number().default(0),
});

accountsRouter.get("/", async (_req, res) => {
  const accounts = await prisma.account.findMany({
    where: { archived: false },
    include: { groups: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(accounts);
});

accountsRouter.post("/", async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { openingBalance, ...data } = parsed.data;

  const account = await prisma.account.create({
    data: {
      ...data,
      groups: {
        create: {
          name: "General",
          isDefault: true,
          openingBalance,
        },
      },
    },
    include: { groups: true },
  });
  res.status(201).json(account);
});

accountsRouter.get("/:id", async (req, res) => {
  const account = await prisma.account.findUnique({
    where: { id: req.params.id },
    include: { groups: true },
  });
  if (!account) return res.status(404).json({ error: "Account not found" });
  res.json(account);
});

accountsRouter.put("/:id", async (req, res) => {
  const parsed = accountSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { openingBalance, ...data } = parsed.data;
  const account = await prisma.account.update({ where: { id: req.params.id }, data });
  res.json(account);
});

accountsRouter.delete("/:id", async (req, res) => {
  await prisma.account.update({ where: { id: req.params.id }, data: { archived: true } });
  res.status(204).send();
});

// --- Groups nested under an account (multi-purpose fund tracking) ---

const groupSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional().nullable(),
  openingBalance: z.number().default(0),
});

accountsRouter.get("/:id/groups", async (req, res) => {
  const groups = await prisma.group.findMany({
    where: { accountId: req.params.id, archived: false },
    orderBy: { createdAt: "asc" },
  });
  res.json(groups);
});

accountsRouter.post("/:id/groups", async (req, res) => {
  const parsed = groupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const account = await prisma.account.findUnique({ where: { id: req.params.id } });
  if (!account) return res.status(404).json({ error: "Account not found" });

  const group = await prisma.group.create({
    data: { ...parsed.data, accountId: req.params.id },
  });

  if (!account.isMultiPurpose) {
    await prisma.account.update({ where: { id: account.id }, data: { isMultiPurpose: true } });
  }

  res.status(201).json(group);
});
