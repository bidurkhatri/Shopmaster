import type { Request, Response, NextFunction } from "express";
import { HttpError } from "./http.js";

/**
 * Minimal in-memory rate limiter for the PUBLIC (unauthenticated) QR/online endpoints (BE-13).
 * Keyed by a caller-supplied key function — for table ordering that's the table/session token, not
 * just the IP, since a busy restaurant's whole floor shares one IP. In production this is Redis-backed.
 */
export function rateLimit(opts: { windowMs: number; max: number; key?: (req: Request) => string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const keyFn = opts.key ?? ((req) => req.ip ?? "unknown");

  return (req: Request, _res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = keyFn(req);
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      throw new HttpError(429, "Too many requests — slow down.");
    }
    next();
  };
}
