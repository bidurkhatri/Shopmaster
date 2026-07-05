import path from "node:path";
import { fileURLToPath } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
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

const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");

const globalForPrisma = globalThis as unknown as { basePrisma?: PrismaClient };

/** The real client. Application code never imports this directly — it goes through the proxy below. */
const basePrisma: PrismaClient =
  globalForPrisma.basePrisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDbUrl() } },
    log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.basePrisma = basePrisma;

/**
 * Holds the transaction-scoped client for the *current* async context. When a request (or any unit
 * of work) runs inside `withTenantContext`, every query issued through the exported `prisma` proxy is
 * routed to this transaction — the one that has `app.org_id` set — so Postgres RLS (DB-04) actually
 * filters. Outside such a context (and always on SQLite), it's empty and queries hit the base client.
 */
const tenantStore = new AsyncLocalStorage<PrismaClient>();

/**
 * The client the whole app imports. It's a thin proxy that transparently dispatches to the
 * tenant-scoped transaction when one is active, and to the base client otherwise. This is what lets
 * RLS be the *active* second layer without threading a client through every function signature.
 */
export const prisma: PrismaClient = new Proxy(basePrisma, {
  get(target, prop, receiver) {
    const active = tenantStore.getStore() ?? target;
    const value = Reflect.get(active, prop, receiver);
    return typeof value === "function" ? value.bind(active) : value;
  },
}) as PrismaClient;

/**
 * Run `fn` with Postgres Row-Level Security scoped to one organization (DB-04). On Postgres it opens
 * a transaction, sets the `app.org_id` GUC the RLS policies key off (SET LOCAL = pool-safe), and
 * binds that transaction as the ambient client for the duration, so every query inside — through the
 * `prisma` proxy — is doubly guarded (app-layer scoping + RLS). On SQLite (no RLS) it just runs `fn`
 * against the base client. Verified against real Postgres via `pnpm --filter @shopmaster/db verify:rls`.
 */
export async function withTenantContext<T>(organizationId: string, fn: (client: PrismaClient) => Promise<T>): Promise<T> {
  if (!isPostgres) return fn(basePrisma);
  return basePrisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SELECT set_config('app.org_id', $1, true)", organizationId);
      return tenantStore.run(tx as unknown as PrismaClient, () => fn(tx as unknown as PrismaClient));
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}

/**
 * Run `fn` atomically, reusing the ambient tenant transaction when there is one (so we never try to
 * open an unsupported *nested* interactive transaction inside `withTenantContext`), otherwise opening
 * a fresh transaction on the base client. Core code that needs a multi-statement transaction should
 * use this instead of `prisma.$transaction`.
 */
export async function transactionally<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
  const ambient = tenantStore.getStore();
  if (ambient) return fn(ambient);
  return basePrisma.$transaction((tx) => fn(tx as unknown as PrismaClient));
}

/** True when the runtime is connected to Postgres (RLS applies); false on the self-contained SQLite. */
export const usingPostgres = isPostgres;

export { Prisma, PrismaClient };
export * from "@prisma/client";
