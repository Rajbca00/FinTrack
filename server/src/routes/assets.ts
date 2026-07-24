import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const assetsRouter = Router();

const ASSET_TYPES = [
  "FIXED_DEPOSIT",
  "MUTUAL_FUND",
  "EPF",
  "PPF",
  "GOLD",
  "CASH",
  "REAL_ESTATE",
  "VEHICLE",
  "CRYPTO",
  "OTHER",
] as const;

const assetSchema = z.object({
  name: z.string().min(1),
  type: z.enum(ASSET_TYPES),
  currentValue: z.number(),
  purchaseValue: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

assetsRouter.get("/", async (_req, res) => {
  const assets = await prisma.asset.findMany({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
  });
  res.json(assets);
});

assetsRouter.post("/", async (req, res) => {
  const parsed = assetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const asset = await prisma.asset.create({ data: parsed.data });
  res.status(201).json(asset);
});

assetsRouter.put("/:id", async (req, res) => {
  const parsed = assetSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const asset = await prisma.asset.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(asset);
});

assetsRouter.delete("/:id", async (req, res) => {
  await prisma.asset.update({ where: { id: req.params.id }, data: { archived: true } });
  res.status(204).send();
});
