import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodError } from "zod";
import type { TenantContext } from "@shopmaster/core";
import type { SessionClaims } from "@shopmaster/core";

// Augment Express Request with our per-request auth context.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: TenantContext;
      claims?: SessionClaims;
    }
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wrap an async handler so thrown errors reach the error middleware. */
export function h(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function requireCtx(req: Request): TenantContext {
  if (!req.ctx) throw new HttpError(401, "Authentication required");
  return req.ctx;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "ValidationError", details: err.flatten() });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const name = (err as { name?: string })?.name;
  if (name === "TenantViolationError") {
    res.status(403).json({ error: "Cross-tenant access denied" });
    return;
  }
  // eslint-disable-next-line no-console
  console.error("Unhandled API error:", err);
  res.status(500).json({ error: "Internal server error" });
}
