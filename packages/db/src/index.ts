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

export { Prisma, PrismaClient };
export * from "@prisma/client";
