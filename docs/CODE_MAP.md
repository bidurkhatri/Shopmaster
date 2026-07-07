# ShopMaster — Code Map (requirement ID → implementation)

Where each requirement from the specification lives in the code, and what is fully implemented vs.
scaffolded behind the real interface.

## Product requirements (PRD)

| ID(s) | Requirement | Where | Status |
|---|---|---|---|
| POS-01,02,04,06 | Order entry, kitchen routing, split, multi-tender | `apps/web/.../pos`, `packages/core/order` | ✅ |
| POS-10, LOC-02 | Per-jurisdiction line-item tax (NP VAT incl / AU GST excl) | `packages/core/pricing-tax.ts` | ✅ (unit-tested) |
| PAY-06 | Tipping (percentage presets + custom, per-payment, reported/paid out separately) | `apps/web/.../pos` payment modal, `core/order`, `core/reporting.ts` | ✅ |
| POS-12 | Quick mode (three-button tea stall) | `resolveCapabilities` + `apps/web/.../pos` | ✅ |
| POS-07 | Shift management + cash-drawer reconciliation (float, cash sales/refunds, expected vs counted, variance) | `packages/core/shift.ts`, `/shifts`, `apps/web/.../admin` Cash tab | ✅ (Growth+) |
| KIOSK-01..06 | Self-service kiosk, guided, order-ready | `apps/web/.../kiosk` | ✅ UI; OS-level lockdown (FE-08) stubbed |
| QR-01..06 | QR/NFC table ordering, no app | `apps/web/.../t/[qrToken]`, `/tables/:qrToken` | ✅ |
| WEB-01..06 | Branded online ordering, no commission | `apps/web/.../s/[slug]`, `StorefrontOrdering` | ✅ |
| MENU-01,02,04 | Central menu, i18n, instant 86 | `packages/core/menu.ts` | ✅ |
| PAY-01,04,07 | Cash first-class, adapter per rail, tokenized | `packages/core/payments` | ✅ Cash real; rails **mock** |
| STAFF-01 | Role-based permissions | `packages/shared/permissions.ts` | ✅ |
| RPT-01..04 | Sales/day, item/payment mix, per-rail, offline-inclusive, CSV | `packages/core/reporting.ts`, `/reports` | ✅ |
| HW-01,04 | PWA-first, browser POS | `apps/web` (Next.js) + manifest/`sw.js`/offline shell (installable, offline-capable) | ✅ PWA; native RN packaging stubbed |
| SYNC-01..05 | Offline order/cash, outbox, conflict merge, status indicator | `apps/web/src/lib/outbox.ts`, `/sync`, replay | ✅ |
| ADMIN-01,02 | Web console, config | `apps/web/.../admin` | ✅ |
| LOC-01,03..05 | NPR/AUD, EN/NE, Nepal IRD/CBMS | i18n + tax done; **IRD/CBMS documented, not built** | ◑ |
| INV-01,02 | Inventory: stock tracking, auto-deduct on confirm, auto-86 at zero, low-stock alerts, movement audit | `packages/core/inventory.ts`, `/inventory`, `apps/web/.../admin` Inventory tab | ✅ (Growth+) |
| CRM-01,02 | Opt-in rewards profiles + loyalty (visits, spend, points derived from orders) | `packages/core/crm.ts`, `/customers`, storefront opt-in, `apps/web/.../admin` Customers tab | ✅ (Growth+) |
| MULTI | Multi-location: Enterprise chain with per-location reports & orders and an admin location switcher | `salesReport`/`listOrders` locationId scoping, admin switcher, seeded 2-location chain (Metro Coffee) | ✅ (Enterprise) |

## Backend (BE)

| ID | Where |
|---|---|
| BE-01 Node/TS, types once | `packages/shared` imported by api + web |
| BE-02 REST v1 | `apps/api/src/routes/*` |
| BE-03 modular monolith, event emission | `packages/core/*` modules; `core/events/emitter.ts` (in-process, Redis/BullMQ stubbed) |
| BE-04 idempotency | `ingestEvents` (unique `idempotencyKey`, P2002 → duplicate) |
| BE-05/07..09 payments abstraction | `packages/core/payments/index.ts` |
| BE-06 sync-state endpoint | `GET /sync/state` |
| BE-10/11 tenant middleware + scoping | `apps/api/src/auth-middleware.ts`, `packages/core/tenancy.ts` |
| BE-13 public endpoint rate limiting | `apps/api/src/rate-limit.ts`, `routes/public-orders.ts` |

## Data (DB)

| ID | Where |
|---|---|
| DB-01 on-device SQLite | client-side outbox (IndexedDB) mirrors this role |
| DB-02 cloud Postgres | **SQLite here** (portable schema in `schema.postgres.prisma`); on Postgres, RLS is the active 2nd layer |
| DB-04 RLS as active second guard | `withTenantContext` + `prisma` proxy (`packages/db`), wired per authenticated request via `tenantContext` middleware; policies in `rls.sql`; verified both at SQL level and through the app primitive (`verify:rls`, `verify:rls:prisma`) |
| DB-03/05 org+location scoping | every model carries `organizationId`; `tenancy.ts` |
| DB-06..10 event log, replay, conflict, materialized view | `packages/core/order/replay.ts` + `service.ts` |
| DB-12/13 indexes | `packages/db/prisma/schema.prisma` |

## Frontend (FE)

| ID | Where |
|---|---|
| FE-01/02 staff vs customer surfaces | `app/(staff)` vs `app/(customer)` (route groups; native RN split is the productionization step) |
| FE-03/04 local-first outbox | `apps/web/src/lib/outbox.ts` |
| FE-06/07 capability manifest | `packages/shared/capabilities.ts`, consumed by nav/POS |
| FE-09/10 design system, Devanagari | `apps/web/src/components/ui.tsx`, i18n, verified in E2E screenshot |
| FE-11 sync indicator | `apps/web/src/components/SyncIndicator.tsx` |
| FE-12 card-offline → cash | POS payment modal |

## Auth (Auth-Flow)

| Tier | Where |
|---|---|
| Tier-1 login/pair (Auth0-swappable JWT) | `packages/core/auth.ts`, `routes/auth.ts` |
| Tier-2 offline PIN | `verifyPin`, `apps/web/.../switch` |

## Payments (PAYINT)

`packages/core/payments/index.ts` — Cash (real) + Fonepay/eSewa/Khalti/Tyro (**mock**, no network,
no real money). `railsForCurrency` gates rails per market; **no Web3 adapter exists**, and no crypto
rail is ever selectable for an NPR merchant (PAYINT §6.1, hard rule).

Legend: ✅ implemented · ◑ partial/documented · ○ Phase 2/3 scaffold.
