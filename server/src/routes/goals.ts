import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const goalsRouter = Router();

const goalSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number(),
  currentAmount: z.number().default(0),
  targetDate: z.string().optional().nullable(),
  linkedAccountId: z.string().optional().nullable(),
  linkedAssetId: z.string().optional().nullable(),
});

function toData(parsed: z.infer<typeof goalSchema>) {
  const { targetDate, ...rest } = parsed;
  return { ...rest, targetDate: targetDate ? new Date(targetDate) : targetDate };
}

goalsRouter.get("/", async (_req, res) => {
  const goals = await prisma.goal.findMany({
    where: { archived: false },
    include: { linkedAccount: true, linkedAsset: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(goals);
});

goalsRouter.post("/", async (req, res) => {
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const goal = await prisma.goal.create({ data: toData(parsed.data) });
  res.status(201).json(goal);
});

goalsRouter.put("/:id", async (req, res) => {
  const parsed = goalSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { targetDate, ...rest } = parsed.data;
  const data = { ...rest, ...(targetDate !== undefined ? { targetDate: targetDate ? new Date(targetDate) : null } : {}) };
  const goal = await prisma.goal.update({ where: { id: req.params.id }, data });
  res.json(goal);
});

goalsRouter.delete("/:id", async (req, res) => {
  await prisma.goal.update({ where: { id: req.params.id }, data: { archived: true } });
  res.status(204).send();
});
