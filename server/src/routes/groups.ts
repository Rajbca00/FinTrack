import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const groupsRouter = Router();

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional().nullable(),
  openingBalance: z.number().optional(),
});

groupsRouter.put("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const group = await prisma.group.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(group);
});

groupsRouter.delete("/:id", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found" });
  if (group.isDefault) return res.status(400).json({ error: "Cannot delete the default group" });

  const txnCount = await prisma.transaction.count({ where: { groupId: group.id } });
  if (txnCount > 0) {
    return res.status(400).json({ error: "Move or delete this group's transactions before removing it" });
  }

  await prisma.group.update({ where: { id: req.params.id }, data: { archived: true } });
  res.status(204).send();
});
