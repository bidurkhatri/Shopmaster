import express from "express";
import cors from "cors";
import { authenticate } from "./auth-middleware.js";
import { errorHandler } from "./http.js";
import { authRouter } from "./routes/auth.js";
import { orgsRouter } from "./routes/orgs.js";
import { menuRouter } from "./routes/menu.js";
import { ordersRouter } from "./routes/orders.js";
import { publicOrdersRouter } from "./routes/public-orders.js";
import { syncRouter } from "./routes/sync.js";
import { reportsRouter } from "./routes/reports.js";
import { contextRouter } from "./routes/context.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Attach a validated tenant context from the Bearer token, if present, on every request.
  app.use(authenticate);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "shopmaster-api", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api", orgsRouter);
  app.use("/api", menuRouter);
  app.use("/api", ordersRouter);
  app.use("/api", publicOrdersRouter);
  app.use("/api", syncRouter);
  app.use("/api", reportsRouter);
  app.use("/api", contextRouter);

  app.use(errorHandler);
  return app;
}
