import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const bucketsRouter = Router();

const bucketSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional().nullable(),
  openingBalance: z.number().default(0),
});

async function withBalance<T extends { id: string; openingBalance: number }>(buckets: T[]) {
  return Promise.all(
    buckets.map(async (b) => {
      const [agg, received, spent] = await Promise.all([
        prisma.transaction.aggregate({ where: { bucketId: b.id }, _sum: { amount: true }, _count: true }),
        prisma.transaction.aggregate({ where: { bucketId: b.id, amount: { gt: 0 } }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { bucketId: b.id, amount: { lt: 0 } }, _sum: { amount: true } }),
      ]);
      return {
        ...b,
        balance: b.openingBalance + (agg._sum.amount ?? 0),
        totalReceived: received._sum.amount ?? 0,
        totalSpent: Math.abs(spent._sum.amount ?? 0),
        transactionCount: agg._count,
      };
    })
  );
}

bucketsRouter.get("/", async (_req, res) => {
  const buckets = await prisma.bucket.findMany({ where: { archived: false }, orderBy: { createdAt: "asc" } });
  res.json(await withBalance(buckets));
});

bucketsRouter.post("/", async (req, res) => {
  const parsed = bucketSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const bucket = await prisma.bucket.create({ data: parsed.data });
  res.status(201).json((await withBalance([bucket]))[0]);
});

bucketsRouter.get("/:id", async (req, res) => {
  const bucket = await prisma.bucket.findUnique({ where: { id: req.params.id } });
  if (!bucket) return res.status(404).json({ error: "Bucket not found" });
  res.json((await withBalance([bucket]))[0]);
});

bucketsRouter.put("/:id", async (req, res) => {
  const parsed = bucketSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const bucket = await prisma.bucket.update({ where: { id: req.params.id }, data: parsed.data });
  res.json((await withBalance([bucket]))[0]);
});

bucketsRouter.delete("/:id", async (req, res) => {
  await prisma.bucket.update({ where: { id: req.params.id }, data: { archived: true } });
  res.status(204).send();
});
