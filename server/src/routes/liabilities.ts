import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const liabilitiesRouter = Router();

const LIABILITY_TYPES = ["HOME_LOAN", "PERSONAL_LOAN", "GOLD_LOAN", "VEHICLE_LOAN", "CREDIT_CARD", "OTHER"] as const;

const liabilitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(LIABILITY_TYPES),
  outstandingBalance: z.number(),
  interestRate: z.number().optional().nullable(),
  emiAmount: z.number().optional().nullable(),
  nextDueDate: z.string().optional().nullable(),
  lender: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function toData(parsed: z.infer<typeof liabilitySchema>) {
  const { nextDueDate, ...rest } = parsed;
  return { ...rest, nextDueDate: nextDueDate ? new Date(nextDueDate) : nextDueDate };
}

liabilitiesRouter.get("/", async (_req, res) => {
  const liabilities = await prisma.liability.findMany({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
  });
  res.json(liabilities);
});

liabilitiesRouter.post("/", async (req, res) => {
  const parsed = liabilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const liability = await prisma.liability.create({ data: toData(parsed.data) });
  res.status(201).json(liability);
});

liabilitiesRouter.put("/:id", async (req, res) => {
  const parsed = liabilitySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { nextDueDate, ...rest } = parsed.data;
  const data = { ...rest, ...(nextDueDate !== undefined ? { nextDueDate: nextDueDate ? new Date(nextDueDate) : null } : {}) };
  const liability = await prisma.liability.update({ where: { id: req.params.id }, data });
  res.json(liability);
});

liabilitiesRouter.delete("/:id", async (req, res) => {
  await prisma.liability.update({ where: { id: req.params.id }, data: { archived: true } });
  res.status(204).send();
});
