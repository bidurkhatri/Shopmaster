import type { Request, Response, NextFunction } from "express";

/**
 * Structured request logging (PLAT-12 — the OBSERVABILITY structured-logging contract).
 *
 * Emits exactly one machine-parseable JSON line per request on stdout, timed off the response's
 * `finish` event so the final status code and full duration are known. The fields follow
 * `docs/operations/OBSERVABILITY.md` §2: `method`, `path`, `status`, `durationMs`, and the tenant
 * dimension `organizationId` (from `req.ctx`, BE-10) when the request carried a validated Bearer
 * context. `timestamp`/`level` round out the stable core set so the line is queryable, not just
 * readable.
 *
 * Hard rule (OBSERVABILITY.md §2 / DATA_BREACH_RESPONSE.md §1): a log line is a place a breach can
 * happen — so it carries the HTTP shape and the tenant id only. It never logs personal information
 * (customer name/phone/address), never secrets or credential material, and never a request or
 * response body. No external dependency; plain `console.log` to stdout, where the platform's
 * structured-log pipeline picks it up.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startNs = process.hrtime.bigint();
  // Capture up front — routing mutates req.url as it descends into sub-routers.
  const method = req.method;
  const path = req.path;

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    const line: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level: "info",
      method,
      path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 1000) / 1000,
    };
    // The tenant dimension (BE-10) — included only when a validated context is present, never invented.
    if (req.ctx?.organizationId) {
      line.organizationId = req.ctx.organizationId;
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(line));
  });

  next();
}
