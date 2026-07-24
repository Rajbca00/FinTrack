import express from "express";
import cors from "cors";
import path from "path";
import { basicAuth } from "./middleware/basicAuth";
import { accountsRouter } from "./routes/accounts";
import { groupsRouter } from "./routes/groups";
import { categoriesRouter } from "./routes/categories";
import { rulesRouter } from "./routes/rules";
import { transactionsRouter } from "./routes/transactions";
import { importsRouter } from "./routes/imports";
import { transfersRouter } from "./routes/transfers";
import { summaryRouter } from "./routes/summary";
import { assetsRouter } from "./routes/assets";
import { liabilitiesRouter } from "./routes/liabilities";
import { goalsRouter } from "./routes/goals";
import { budgetsRouter } from "./routes/budgets";

export function createApp() {
  const app = express();
  app.use(basicAuth);
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
  app.use("/api/assets", assetsRouter);
  app.use("/api/liabilities", liabilitiesRouter);
  app.use("/api/goals", goalsRouter);
  app.use("/api/budgets", budgetsRouter);

  // In production this single Node service also serves the built React app,
  // so Render only needs one web service (no separate static site / CDN).
  if (process.env.NODE_ENV === "production") {
    const clientDist = path.join(__dirname, "../../client/dist");
    app.use(express.static(clientDist));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  });

  return app;
}
