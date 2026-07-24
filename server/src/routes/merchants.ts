import { Router } from "express";
import { suggestForDescription, getMerchantIntelligence } from "../services/merchants";

export const merchantsRouter = Router();

merchantsRouter.get("/suggest", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const suggestion = await suggestForDescription(q);
  res.json(suggestion);
});

merchantsRouter.get("/top", async (_req, res) => {
  res.json(await getMerchantIntelligence());
});
