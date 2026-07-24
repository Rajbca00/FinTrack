import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { rollForwardBills, groupBillsByWindow, suggestBills } from "../services/bills";

export const billsRouter = Router();

const RECURRENCES = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;

const billSchema = z.object({
  name: z.string().min(1),
  amount: z.number(),
  categoryId: z.string().optional().nullable(),
  nextDueDate: z.string().min(1),
  recurrence: z.enum(RECURRENCES).default("MONTHLY"),
  autoDetected: z.boolean().optional(),
});

billsRouter.get("/", async (_req, res) => {
  const raw = await prisma.bill.findMany({ where: { archived: false }, include: { category: true } });
  const categoryById = new Map(raw.map((b) => [b.id, b.category]));
  const rolled = await rollForwardBills(raw);
  const withCategory = rolled
    .map((b) => ({ ...b, category: categoryById.get(b.id) ?? null }))
    .sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
  res.json({ bills: withCategory, groups: groupBillsByWindow(withCategory) });
});

billsRouter.get("/suggestions", async (_req, res) => {
  res.json(await suggestBills());
});

billsRouter.post("/", async (req, res) => {
  const parsed = billSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { nextDueDate, ...rest } = parsed.data;
  const bill = await prisma.bill.create({ data: { ...rest, nextDueDate: new Date(nextDueDate) }, include: { category: true } });
  res.status(201).json(bill);
});

billsRouter.put("/:id", async (req, res) => {
  const parsed = billSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { nextDueDate, ...rest } = parsed.data;
  const data = { ...rest, ...(nextDueDate !== undefined ? { nextDueDate: new Date(nextDueDate) } : {}) };
  const bill = await prisma.bill.update({ where: { id: req.params.id }, data, include: { category: true } });
  res.json(bill);
});

billsRouter.delete("/:id", async (req, res) => {
  await prisma.bill.update({ where: { id: req.params.id }, data: { archived: true } });
  res.status(204).send();
});
