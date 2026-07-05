# Changelog

All notable changes to ShopMaster are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version IDs in parentheses (`GAP-##`, `PLAT-##`, `DB-##`, `PAY-##`, `PAYINT-##`, `BE-##`, `Auth-Flow`)
reference the specification in [`docs/`](./docs). What is fully implemented vs. documented behind a
real interface is mapped in [`docs/CODE_MAP.md`](./docs/CODE_MAP.md); the road from here to production
is [`docs/SHIP_CHECKLIST.md`](./docs/SHIP_CHECKLIST.md).

## [Unreleased]

_Nothing yet. The next changes are the go-live gates in
[`docs/SHIP_CHECKLIST.md`](./docs/SHIP_CHECKLIST.md) — Postgres+RLS, live payment rails, Auth0, the
isolation/sync test suites, and the merchant-onboarding flow._

## [0.1.0] — 2026-07-05

First tagged release. This repository now holds **both** the Phase-1 implementation of ShopMaster and
the shipment collateral needed to take it from a self-contained build to a production launch. It is a
faithful, end-to-end-verified web realization of the architecture in [`docs/`](./docs), with the
harder pieces scaffolded behind the real interfaces the docs define.

### Added — Phase-1 implementation

- **Monorepo skeleton.** pnpm workspace: `packages/{shared,db,core}`, `apps/{api,web}`, `e2e/`. Types
  are defined once in `shared` and imported by both API and web so the contract can't drift (`BE-01`).
- **`@shopmaster/shared`.** Enums, Zod request/payload schemas, i18n + money helpers (integer minor
  units), RBAC matrix (`STAFF-01`), the capability manifest (`FE-06/07`), and `OrderEvent` payload
  schemas.
- **`@shopmaster/db`.** Prisma schema (the ERD) + client + seed on **SQLite**, self-contained. Schema
  is Postgres-portable by design; a verbatim `schema.postgres.prisma` ships alongside it (`DB-02`).
- **`@shopmaster/core`.** Domain modules: the jurisdiction-aware pricing/tax engine (AU GST exclusive
  vs. NP VAT inclusive, `POS-10`/`LOC-02`), the **event-sourced** order engine with deterministic
  replay and cross-device conflict resolution (`DB-06..DB-10`, `DB-09` earliest-timestamp-wins with
  the losing edit preserved in the audit trail), the payments abstraction, staff/auth, tenancy, and
  reporting.
- **`@shopmaster/api`.** Express modular-monolith REST backend (`BE-02/03`): auth, public
  storefront/QR, public rate-limited customer ordering (`BE-13`), orders + kitchen, offline sync,
  reports. Tenant middleware derives `organizationId`/`role`/`locationIds` from the signed JWT only
  (`BE-10/11`); idempotent event ingest via unique `idempotencyKey` (`BE-04`).
- **`@shopmaster/web`.** Next.js (App Router) client for all four channels — staff POS/kiosk/admin and
  customer QR/online — with the local-first outbox + background sync worker (`FE-03/04`, `SYNC-01..05`),
  capability-driven navigation, EN/NE localization (Devanagari), per-merchant theming, and the sync
  indicator.
- **Two-tier auth (`Auth-Flow`).** Tier-1 email+password → signed HS256 JWT (Auth0-swappable); Tier-2
  offline PIN verified against a locally-cached bcrypt hash with zero connectivity.
- **Payments abstraction (`PAY-01/04/07`).** One `authorize/capture/refund/getStatus` interface, one
  adapter per rail. **Cash is the real adapter**; Fonepay/eSewa/Khalti/Tyro ship as clearly-labelled
  **mock** adapters (no network, no real money). `railsForCurrency` gates rails per market; **no Web3
  adapter exists** and no crypto rail is ever selectable for an NPR merchant (`PAYINT §6.1`).
- **Tests.** Vitest unit suite (tax engine + event replay incl. the `DB-09` conflict case) and a
  Playwright end-to-end suite (login → POS cash payment via outbox, kitchen display, admin dashboard,
  QR order, branded Nepali storefront, kiosk) with screenshots.

### Added — shipment collateral

- **Contract & map.** [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) (closes `GAP-04`) and
  [`docs/CODE_MAP.md`](./docs/CODE_MAP.md) (requirement ID → implementation, real vs. stubbed).
- **Productionization guides.** [`docs/POSTGRES.md`](./docs/POSTGRES.md) (SQLite→Postgres swap `DB-02`
  + Row-Level Security `DB-04`), [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) (managed-container
  deploy, CI/CD approval gate, secrets), and the container definitions `Dockerfile.api`,
  `Dockerfile.web`, `.dockerignore`, `docker-compose.yml` plus `.env.example` templates.
- **Operations.** [`docs/operations/OBSERVABILITY.md`](./docs/operations/OBSERVABILITY.md)
  (`PLAT-12/13` — the three ShopMaster-specific metrics and pre-set alert thresholds),
  [`docs/operations/DISASTER_RECOVERY.md`](./docs/operations/DISASTER_RECOVERY.md) (`PLAT-15/16` —
  automated backups + tested restore drill, proposed RPO/RTO),
  [`docs/operations/SECURITY.md`](./docs/operations/SECURITY.md) (control→code, incl. `PLAT-14`
  secrets and `PAY-07` tokenization),
  [`docs/operations/DATA_BREACH_RESPONSE.md`](./docs/operations/DATA_BREACH_RESPONSE.md) (`GAP-10`),
  and [`docs/operations/HARDWARE_COMPATIBILITY.md`](./docs/operations/HARDWARE_COMPATIBILITY.md)
  (`GAP-09`).
- **Legal drafts (counsel-ready, `GAP-02`).**
  [`docs/legal/TERMS_OF_SERVICE.md`](./docs/legal/TERMS_OF_SERVICE.md),
  [`docs/legal/PRIVACY_POLICY.md`](./docs/legal/PRIVACY_POLICY.md), and
  [`docs/legal/MERCHANT_AGREEMENT.md`](./docs/legal/MERCHANT_AGREEMENT.md) — all `Version 0.1 — Draft
  for counsel review`, pending the legal-entity decision (`GAP-01`).
- **Business.** [`docs/business/UNIT_ECONOMICS.md`](./docs/business/UNIT_ECONOMICS.md) and
  [`docs/business/PRICING.md`](./docs/business/PRICING.md) (`GAP-03`, illustrative assumptions to
  validate) and [`docs/business/GTM.md`](./docs/business/GTM.md) (`GAP-12`).
- **Ship checklist.** [`docs/SHIP_CHECKLIST.md`](./docs/SHIP_CHECKLIST.md) — the pre-launch gates,
  sorted into blocking vs. fast-follow, mapping every deferred item to a concrete exit criterion.
- **This changelog.**

### Known limitations (deferred behind their real interfaces)

Consistent with the Phase-1 status, these ship **documented and switched off**, not built: managed
Postgres + RLS (SQLite here — `DB-02/04`), Auth0 (self-contained JWT stands in — `Auth-Flow`), live
payment rails (Fonepay/eSewa/Khalti/Tyro are **mock** — `PAYINT §8`), Redis/BullMQ (in-process
emitter — `BE-03`), native app packaging (PWA delivered — `HW-01`), the Nepal IRD/CBMS audit server
(`PLAT-07/08`), and the multi-tenancy-isolation (`GAP-05`) and sync-conflict (`GAP-06`) test suites.
The merchant-onboarding flow (`GAP-07`) and the legal-entity decision (`GAP-01`) remain open. See
[`NEXT_STEPS.md`](./NEXT_STEPS.md) and [`docs/SHIP_CHECKLIST.md`](./docs/SHIP_CHECKLIST.md).

[Unreleased]: https://example.com/shopmaster/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/shopmaster/releases/tag/v0.1.0
</content>
