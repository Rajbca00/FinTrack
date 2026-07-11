import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const categoriesRouter = Router();

const categorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

categoriesRouter.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { transactions: true, rules: true } } },
  });
  res.json(categories);
});

categoriesRouter.post("/", async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const category = await prisma.category.create({ data: parsed.data });
  res.status(201).json(category);
});

categoriesRouter.put("/:id", async (req, res) => {
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const category = await prisma.category.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(category);
});

categoriesRouter.delete("/:id", async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!category) return res.status(404).json({ error: "Category not found" });
  if (category.isSystem) return res.status(400).json({ error: "Cannot delete a system category" });

  const txnCount = await prisma.transaction.count({ where: { categoryId: category.id } });
  if (txnCount > 0) {
    return res.status(400).json({ error: `${txnCount} transaction(s) use this category. Reassign them first.` });
  }

  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
