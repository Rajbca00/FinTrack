import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const attachmentsRouter = Router();

// Raw file size cap - base64 inflates this by ~4/3, so 5MB raw keeps the
// encoded payload comfortably under app.ts's express.json 10mb limit.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const uploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  data: z.string().min(1), // base64, no data: URL prefix
});

attachmentsRouter.get("/transactions/:transactionId/attachments", async (req, res) => {
  const attachments = await prisma.attachment.findMany({
    where: { transactionId: req.params.transactionId },
    select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(attachments);
});

attachmentsRouter.post("/transactions/:transactionId/attachments", async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const transaction = await prisma.transaction.findUnique({ where: { id: req.params.transactionId } });
  if (!transaction) return res.status(404).json({ error: "Transaction not found" });

  const size = Buffer.byteLength(parsed.data.data, "base64");
  if (size > MAX_ATTACHMENT_BYTES) {
    return res.status(400).json({ error: `Attachment too large (max ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB)` });
  }

  const attachment = await prisma.attachment.create({
    data: { transactionId: req.params.transactionId, filename: parsed.data.filename, mimeType: parsed.data.mimeType, size, data: parsed.data.data },
    select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
  });
  res.status(201).json(attachment);
});

attachmentsRouter.get("/attachments/:id", async (req, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
  if (!attachment) return res.status(404).json({ error: "Attachment not found" });
  res.json(attachment);
});

attachmentsRouter.delete("/attachments/:id", async (req, res) => {
  await prisma.attachment.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
