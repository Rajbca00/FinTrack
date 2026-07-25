import { Router } from "express";
import { z } from "zod";
import { exportAllData, importAllData, resetAllData } from "../services/backup";

export const settingsRouter = Router();

settingsRouter.get("/export", async (_req, res) => {
  const payload = await exportAllData();
  res.setHeader("Content-Disposition", `attachment; filename="fintrack-backup-${payload.exportedAt.slice(0, 10)}.json"`);
  res.json(payload);
});

const importSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

settingsRouter.post("/import", async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "That doesn't look like a FinTrack backup file" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await importAllData(parsed.data as any);
  res.json({ ok: true });
});

const resetSchema = z.object({ confirm: z.literal("RESET") });

settingsRouter.post("/reset", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Send { "confirm": "RESET" } to confirm this action' });
  await resetAllData();
  res.json({ ok: true });
});
