# ShopMaster — Deployment

How to build and ship the two ShopMaster services — the API (`apps/api`, an Express
modular monolith) and the web client (`apps/web`, Next.js) — to a managed container
platform. This is the operational counterpart to
[`docs/02-architecture/Shopmaster_Platform_Architecture.md`](./02-architecture/Shopmaster_Platform_Architecture.md);
requirement IDs (`PLAT-##`) reference that document.

> **The images are provided, but not built inside the dev sandbox.** This repository
> ships the container definitions (`Dockerfile.api`, `Dockerfile.web`, `.dockerignore`)
> and a `docker-compose.yml`, but the dev sandbox this code was assembled in cannot run
> `docker build`. Build the images where Docker is available — your CI runner or a
> workstation — using the commands below. Nothing here has been built or run through a
> real container engine yet; treat the first real build as the verification step.

---

## 1. What ships in this repo

| File | Role |
|---|---|
| `Dockerfile.api` | Multi-stage build for `apps/api`. Installs the workspace, generates the Prisma client, runs the API on port **4000**. |
| `Dockerfile.web` | Build for `apps/web`. Installs the workspace, runs `next build`, serves on port **3000**. Takes `NEXT_PUBLIC_API_URL` as a build arg. |
| `.dockerignore` | Keeps `node_modules`, build outputs, local SQLite files, and any `.env` out of the build context (PLAT-14). |
| `docker-compose.yml` | Single-host run of both services (SQLite in a named volume). A commented, profile-gated Postgres service is included for a production-like local run. |
| `apps/api/.env.example`, `apps/web/.env.example` | Documented templates for every env var, with safe placeholders. |

Both Dockerfiles use `node:22-slim`, enable pnpm through Corepack (pinned to the
`packageManager` version in the root `package.json`), and copy the whole monorepo so the
pnpm workspace install (`pnpm install --frozen-lockfile`) resolves deterministically from
the committed lockfile.

---

## 2. Required environment variables

| Variable | Service | Purpose | Example / placeholder |
|---|---|---|---|
| `JWT_SECRET` | api | HS256 signing key for session JWTs (`packages/core/src/auth.ts`, Auth-Flow). | a long random string (`openssl rand -base64 48`) |
| `DATABASE_URL` | api | Prisma datasource. SQLite for a self-contained run; managed Postgres in production (PLAT-05). | `file:/data/shopmaster.db` or `postgresql://…` |
| `NEXT_PUBLIC_API_URL` | web (**build time**) | Browser-reachable base URL of the API, including the `/api` prefix. Inlined into the client bundle by `next build` (`apps/web/src/lib/api.ts`). | `https://api.yourdomain.com/api` |
| `API_PORT` | api | Port the API listens on (`apps/api/src/index.ts` → `API_PORT ?? PORT ?? 4000`). | `4000` |

Optional API vars (`PRISMA_LOG`, `NODE_ENV`) are documented in `apps/api/.env.example`.

Two things worth calling out because they bite people:

- **`NEXT_PUBLIC_API_URL` is a build-time value, not a runtime one.** Next.js inlines
  `NEXT_PUBLIC_*` into the client bundle at `next build`. Setting it only in the running
  container does nothing — the web image must be rebuilt to change it. It also has to be
  the URL the **end user's browser** can reach, not an internal container hostname.
- **`DATABASE_URL` is a secret in production** (it carries the Postgres credentials) and
  must come from the secrets manager, never a committed file (PLAT-14).

---

## 3. Local / single-host run (SQLite)

For a self-contained run on one host, `docker-compose.yml` wires the two services together
with SQLite persisted to a named volume:

```bash
# Build both images and start them (run where Docker is available).
JWT_SECRET="$(openssl rand -base64 48)" docker compose up --build
# → web on http://localhost:3000, API on http://localhost:4000/api
```

The API's `start` script only launches the server; it does **not** create or seed the
database. On a fresh volume, initialise the schema and demo data once:

```bash
# One-time DB init inside the API container (SQLite path from DATABASE_URL).
docker compose run --rm api pnpm --filter @shopmaster/db db:push
docker compose run --rm api pnpm --filter @shopmaster/db seed
```

This is a convenience topology, not the production one — a single SQLite file does not
scale horizontally (PLAT-04) and is not the target for real traffic.

---

## 4. Deploying to a managed container platform (PLAT-03)

Production runs on a **managed container/application platform** — Cloud Run, Fly.io,
Railway, App Runner, and similar all qualify — rather than self-managed Kubernetes. The
API is designed to run as a small number of **stateless, horizontally-scalable instances**
behind the platform's load balancer (PLAT-04), so scaling for a lunch-hour spike is a
matter of adding instances, not re-architecting. Pick a primary region with reasonable
latency to both Nepal and Australia (Singapore or Mumbai are defensible middle grounds —
PLAT-06); the specific vendor is still an open question in the Platform Architecture doc.

Deploy the two images as two services:

- **API service** — image built from `Dockerfile.api`, listening on `4000`. Provide
  `JWT_SECRET`, `DATABASE_URL` (the managed Postgres URL), and `API_PORT` (or let the
  platform inject `PORT`). Point its health checks at `GET /api/health`.
- **Web service** — image built from `Dockerfile.web`, listening on `3000`. Because
  `NEXT_PUBLIC_API_URL` is baked in at build time, pass it as a build argument when you
  build the image for each environment, set to that environment's public API URL:

```bash
docker build -f Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api \
  -t shopmaster-web:staging .
```

Keep three environments — development, staging, production — with staging a genuine mirror
of production topology, including the same database engine (PLAT-01/02). That is exactly
why staging should run Postgres, not SQLite: a multi-tenancy or scaling bug that only
shows up on Postgres must not be able to slip through a smaller, different-shaped
environment.

---

## 5. Managed Postgres (PLAT-05)

Use **managed Postgres** (the same category as Neon, Cloud SQL, Railway Postgres, Fly
Postgres) rather than self-hosting, so backups, point-in-time recovery, and connection
pooling are the provider's problem, not yours. The Prisma schema is **Postgres-portable by
design** — the SQLite-specific choices are deliberate and documented in the schema header:
`String` status/enum fields become native Postgres enums, and TEXT-that-holds-JSON becomes
`jsonb`. To move from SQLite to Postgres:

1. Flip the datasource `provider` in `packages/db/prisma/schema.prisma` from `sqlite` to
   `postgresql`.
2. Set `DATABASE_URL` to the managed Postgres connection string (with `sslmode=require`).
3. Run the schema migration and seed against it.

**Migrations run through the pipeline with a rollback plan attached to each one**
(PLAT-11) — the system's integrity depends on the multi-tenancy and sync data models
staying exactly correct, so schema changes are not applied by hand against production.
Automated backups with a genuinely *tested* restore procedure are a launch requirement, not
a nice-to-have (PLAT-15).

The `docker-compose.yml` contains a commented, profile-gated `postgres` service if you want
a production-like local run before touching a managed provider; it is a stand-in only.

---

## 6. CI/CD and the production approval gate (PLAT-10)

The intended pipeline is deliberately boring: **lint and test on every push, automatic
deploy to staging on merge to `main`, and a production deploy that sits behind a manual
approval gate.** That human gate before production is not caution for its own sake — this
is software that touches other people's money, and a deliberate person-in-the-loop check
before it ships is a reasonable cost for that. A typical shape:

1. **On every push** — `pnpm install`, `pnpm typecheck`, `pnpm test` (and, where a
   browser is available, `pnpm e2e`).
2. **On merge to `main`** — build `Dockerfile.api` and `Dockerfile.web` (the web image
   built once per environment with that environment's `NEXT_PUBLIC_API_URL`), push to the
   registry, and **auto-deploy to staging**.
3. **Promote to production** — the same immutable images, gated behind a **manual
   approval** step. No auto-deploy to production, ever.

Database migrations ride the same pipeline, each with its required rollback plan (PLAT-11).

---

## 7. Secrets (PLAT-14)

Every secret — `JWT_SECRET`, the production `DATABASE_URL`, and later the Auth0 client
secrets and payment-processor keys — lives in a **dedicated secrets manager**, injected as
environment variables at deploy time. Not committed to the repo, not pasted into a deploy
dashboard by hand, not baked into an image. `.dockerignore` keeps every `.env` out of the
build context, and the `.env.example` files carry placeholders only. The promise that no
raw card data touches ShopMaster's own storage (PAY-07) is only as strong as the weakest
secret-handling practice around it.

---

## 8. What this does not cover yet

Consistent with the Phase-1 status in the [README](../README.md), a few production concerns
are documented in the Platform Architecture doc but not wired up here: structured
logging / metrics / error tracking and alert thresholds (PLAT-12/13), the Nepal in-country
audit server (PLAT-07/08, provisioned only when a qualifying merchant approaches the
LOC-03/04 threshold), and firm RPO/RTO targets pending business sign-off (PLAT-16). These
are deliberate deferrals, not oversights — see
[`docs/02-architecture/Shopmaster_Platform_Architecture.md`](./02-architecture/Shopmaster_Platform_Architecture.md)
and [`NEXT_STEPS.md`](../NEXT_STEPS.md).
