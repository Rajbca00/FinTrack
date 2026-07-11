import express from "express";
import cors from "cors";
import { accountsRouter } from "./routes/accounts";
import { groupsRouter } from "./routes/groups";
import { categoriesRouter } from "./routes/categories";
import { rulesRouter } from "./routes/rules";
import { transactionsRouter } from "./routes/transactions";
import { importsRouter } from "./routes/imports";
import { transfersRouter } from "./routes/transfers";
import { summaryRouter } from "./routes/summary";

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/accounts", accountsRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/rules", rulesRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use("/api/import", importsRouter);
  app.use("/api/transfers", transfersRouter);
  app.use("/api/summary", summaryRouter);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  });

  return app;
}
