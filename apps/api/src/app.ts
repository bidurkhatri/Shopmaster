import express from "express";
import cors from "cors";
import { authenticate } from "./auth-middleware.js";
import { errorHandler } from "./http.js";
import { securityHeaders } from "./security.js";
import { requestLogger } from "./logging.js";
import { authRouter } from "./routes/auth.js";
import { onboardingRouter } from "./routes/onboarding.js";
import { orgsRouter } from "./routes/orgs.js";
import { menuRouter } from "./routes/menu.js";
import { inventoryRouter } from "./routes/inventory.js";
import { ordersRouter } from "./routes/orders.js";
import { publicOrdersRouter } from "./routes/public-orders.js";
import { syncRouter } from "./routes/sync.js";
import { reportsRouter } from "./routes/reports.js";
import { contextRouter } from "./routes/context.js";
import { registerInventorySubscriber } from "@shopmaster/core";

export function createApp() {
  registerInventorySubscriber(); // wire stock auto-deduction to the order lifecycle (BE-03 / INV-01)
  const app = express();
  app.use(securityHeaders); // baseline security response headers (SECURITY.md / PLAT-14)
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger); // structured per-request logging (PLAT-12)

  // Attach a validated tenant context from the Bearer token, if present, on every request.
  app.use(authenticate);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "shopmaster-api", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api", onboardingRouter);
  app.use("/api", orgsRouter);
  app.use("/api", menuRouter);
  app.use("/api", inventoryRouter);
  app.use("/api", ordersRouter);
  app.use("/api", publicOrdersRouter);
  app.use("/api", syncRouter);
  app.use("/api", reportsRouter);
  app.use("/api", contextRouter);

  app.use(errorHandler);
  return app;
}
