import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, Prisma } from "@prisma/client";

// This file lives at packages/db/src/index.ts; the SQLite file is packages/db/prisma/dev.db.
const here = path.dirname(fileURLToPath(import.meta.url));
const absoluteDefault = "file:" + path.resolve(here, "..", "prisma", "dev.db");

/**
 * Resolve a usable DATABASE_URL for runtime.
 * SQLite relative `file:` URLs (as used by the Prisma CLI via packages/db/.env) resolve
 * relative to the schema dir, which breaks when the server runs from a different cwd.
 * We normalise those to an absolute path, pass through non-file URLs (e.g. a real Postgres
 * URL in production), and fall back to the packaged default when nothing is set.
 */
function resolveDbUrl(): string {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv && fromEnv.startsWith("file:")) {
    const p = fromEnv.slice("file:".length);
    if (p.startsWith("/")) return fromEnv; // already absolute
    const rel = p.replace(/^\.\//, "");
    return "file:" + path.resolve(here, "..", "prisma", rel);
  }
  if (fromEnv) return fromEnv; // e.g. postgresql://…
  return absoluteDefault;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDbUrl() } },
    log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Run `fn` with Postgres Row-Level Security scoped to one organization (DB-04). On Postgres it opens
 * a transaction and sets the `app.org_id` GUC that the RLS policies key off (SET LOCAL = pool-safe),
 * so every query inside is doubly guarded (app-layer scoping + RLS). On SQLite (no RLS) it just runs
 * `fn` against the base client. This is the primitive to wrap authenticated request handling in to
 * make RLS the *active* second layer app-wide; verified working via `pnpm --filter @shopmaster/db verify:rls`.
 */
export async function withTenantContext<T>(
  organizationId: string,
  fn: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");
  if (!isPostgres) return fn(prisma);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT set_config('app.org_id', $1, true)", organizationId);
    return fn(tx as unknown as PrismaClient);
  });
}

export { Prisma, PrismaClient };
export * from "@prisma/client";
