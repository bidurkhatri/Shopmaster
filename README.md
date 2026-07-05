# ShopMaster

**One order engine, four channels** — staff POS, self-service kiosk, QR/NFC table ordering, and
branded online ordering — all writing to the same menu, the same order record, and the same kitchen
queue. Built so a one-person tea stall in Nepal and a forty-table restaurant in Sydney run on the
**same codebase in a different configuration**, not two different products.

This repository contains both the **product/architecture specification** (in [`docs/`](./docs)) and a
**working, runnable implementation** of it.

> **Status — Phase-1 MVP.** This is a faithful, end-to-end-verified web realization of the
> architecture in `docs/`, with the harder pieces scaffolded behind the real interfaces the docs
> define. See [What's real vs. stubbed](#whats-real-vs-stubbed) and
> [`docs/CODE_MAP.md`](./docs/CODE_MAP.md) for the honest map. The original gap analysis is in
> [`NEXT_STEPS.md`](./NEXT_STEPS.md).

---

## Quick start

Requires Node ≥ 20 and pnpm ≥ 10.

```bash
pnpm install
pnpm db:setup          # prisma generate + db push + seed (SQLite, self-contained)

# run both servers (API on :4000, web on :3000)
pnpm dev
# → open http://localhost:3000
```

Or build and run the production output:

```bash
pnpm build
pnpm start:api &       # :4000
pnpm start:web         # :3000
```

### Demo logins & entry points

| Who | Login | PIN | Storefront | QR table |
|---|---|---|---|---|
| Sydney restaurant (Growth, full mode) | `owner@harbour-view.test` / `password123` | 1111–5555 | `/s/harbour-view` | `/t/hv-t1` … `/t/hv-t8` |
| Nepal tea stall (Starter, quick mode) | `owner@himalayan-tea.test` / `password123` | 1234 | `/s/himalayan-tea` | `/t/tea-counter` |

The landing page at `/` links every surface.

---

## The five things to understand (from the PRD)

1. **One engine, many faces.** POS, kiosk, QR/NFC and online ordering are clients of one order/menu
   core — never separate systems kept in sync by hand.
2. **Progressive complexity.** Tier + business type resolve to a runtime **capability manifest**; the
   same app is a three-button tea-stall POS or a full restaurant back office.
3. **Offline-first.** The POS writes every action to a local **outbox** first; a background worker
   drains it to the server when connectivity returns. Cash works offline; card/digital falls back to
   cash (it can't authorize offline).
4. **Zero mandatory hardware.** Runs from one phone/browser (PWA-first).
5. **Branded, not marketplace; never holds money.** Every payment settles to the merchant's own
   account; there is **no crypto path for a Nepal merchant** (a hard legal wall).

---

## Architecture

A pnpm monorepo. Types are defined once in `shared` and imported by both the API and the web client
(BE-01), so the contract can't drift.

```
docs/            The 12-document specification (PRD, architecture, flows, payments) + API_CONTRACT + CODE_MAP
packages/
  shared/        Enums, Zod schemas, i18n/money helpers, RBAC, capability manifest, order-event payloads
  db/            Prisma schema (the ERD) + client + seed — SQLite, self-contained
  core/          Domain modules: pricing-tax · order (event-sourced) · payments · staff/auth · tenancy · reporting
apps/
  api/           Express modular-monolith REST backend
  web/           Next.js (App Router) — staff (POS/kiosk/admin) + customer (QR/online) surfaces
e2e/             Playwright end-to-end suite + screenshots
```

**Stack:** TypeScript, Express + Prisma + SQLite (Postgres-portable), Next.js 14 + React 18 +
Tailwind, `jose`/`bcryptjs` auth, Zod validation, Vitest + Playwright.

### How an order actually works (event-sourced)

An order is **not** a mutable row — it's an append-only log of device-signed `OrderEvent`s
(`ORDER_CREATED`, `ITEM_ADDED`, `PAYMENT_CAPTURED`, …). The server **replays** that log to compute the
materialized `Order`/`OrderItem` rows (DB-06..DB-10). This is what makes offline merges correct: two
devices editing the same table while offline both land, and a genuine cross-device conflict resolves
deterministically (earliest device timestamp wins, the losing edit preserved in the audit trail).

---

## Testing

```bash
pnpm test        # Vitest unit tests (pricing-tax, event replay + conflict resolution)
pnpm e2e         # Playwright end-to-end (needs the servers running; see e2e/)
pnpm typecheck   # tsc across every package
```

- **Unit (17 tests):** the jurisdiction-aware tax engine (AU GST exclusive vs NP VAT inclusive) and
  the event-replay engine, including the DB-09 cross-device conflict case.
- **E2E (7 flows):** login → POS cash payment (via outbox), kitchen display, admin dashboard, QR
  customer order, branded Nepali storefront (Devanagari/NPR), kiosk. Screenshots land in
  `e2e/screenshots/`.

---

## What's real vs. stubbed

**Real & working:** the modular-monolith backend, the event-sourced order engine + conflict
resolution, multi-tenancy scoping (with API-boundary isolation), the jurisdiction-aware tax engine,
two-tier auth (password + offline PIN), the payments abstraction with a real **Cash** adapter, all
four channels as web clients, the admin console with live reporting, EN/NE localization, per-merchant
theming, and the offline outbox + sync.

**Stubbed behind the real interface (see [`docs/CODE_MAP.md`](./docs/CODE_MAP.md)):** native
iOS/Android packaging (web/PWA delivered instead), Auth0 (self-contained JWT stands in), live payment
rails (Fonepay/eSewa/Khalti/Tyro are clearly-labelled **mock** adapters — no real money), Postgres +
Row-Level Security (SQLite here; schema is portable), Redis/BullMQ (in-process emitter), the Nepal
IRD/CBMS audit server, and Web3 payments (deliberately out of scope; never for Nepal).

The product-level gaps (legal docs, unit economics, onboarding polish) remain as documented in
[`NEXT_STEPS.md`](./NEXT_STEPS.md).
