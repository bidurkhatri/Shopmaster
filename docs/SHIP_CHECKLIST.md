# ShopMaster — Ship Checklist

The pre-launch gate list. It maps every deferred item — the things this repo ships **documented
behind a real interface** rather than switched on — to a concrete, verifiable go-live gate, and sorts
those gates into **Blocking** (a real merchant cannot legally or safely take a real customer's first
real order and real money until this is green) and **Fast-follow** (launch can proceed to a
controlled pilot; close these on a short, named clock after).

This is the operational sibling of [`../NEXT_STEPS.md`](../NEXT_STEPS.md) (the gap analysis) and
[`CODE_MAP.md`](./CODE_MAP.md) (what is real vs. stubbed). Where `NEXT_STEPS.md` says *what is
missing* and `CODE_MAP.md` says *where it lives*, this document says *what "done" means and in what
order*. Requirement IDs (`GAP-##`, `PLAT-##`, `DB-##`, `PAY-##`, `PAYINT-##`, `BE-##`, `Auth-Flow`)
trace back to the specification in [`docs/`](.) and to the productionization guides that already
exist for most of these gates.

> **The point of the two-bucket split.** Almost every one of these is already *designed and
> documented* — the guides in `docs/POSTGRES.md`, `docs/DEPLOYMENT.md`, `docs/operations/*` and
> `docs/legal/*` exist precisely so each gate is "wire up and verify," not "figure out." A **Blocking**
> gate is one whose failure is a category no controlled pilot can absorb: an illegal onboarding, real
> money lost to a mock adapter, one merchant seeing another's data, or an unrecoverable database. A
> **Fast-follow** gate is real work that a small, supervised, in-person-first launch can run without
> for a short, bounded window.

---

## How to read a gate

Each gate below has:

- **Gate** — the one thing that must become true.
- **Exit criterion** — the concrete, checkable evidence that it *is* true. "Documented" is never an
  exit criterion; "measured / green / reviewed / switched on" is.
- **Where it stands** — what already ships in this repo toward it.
- **Reference** — the guide that tells you how to close it.

A gate is only tickable when its exit criterion is met in the **production** environment (or, for the
test-suite gates, green in CI against a **Postgres** environment that mirrors production — SQLite is
not a valid proving ground for a tenancy or sync bug, per [`DEPLOYMENT.md`](./DEPLOYMENT.md) §4).

---

## Part A — Blocking gates (no go-live without these)

### A1. Legal entity decided (GAP-01)

- [ ] **Gate:** the operating entity, governing-law seat, and IP ownership are decided (standalone
      vs. under/alongside Fintex Australia).
- **Exit criterion:** a named legal entity exists that can sign a merchant agreement, and every
      `[LEGAL ENTITY — TBD, see GAP-01]` / `[GOVERNING LAW — TBD]` placeholder in the legal drafts has
      a real value.
- **Where it stands:** flagged as the Priority-1 foundation gap; **unresolved**. It is upstream of
      A2, A3's pricing, and the breach plan (GAP-10) — none of those can be finalized while the entity
      that signs and is liable is undecided.
- **Reference:** [`../NEXT_STEPS.md`](../NEXT_STEPS.md) GAP-01.

### A2. Legal docs counsel-reviewed and completed (GAP-02)

- [ ] **Gate:** Terms of Service, Privacy Policy, and Merchant Agreement are reviewed and completed by
      a lawyer admitted in **both** Australia and Nepal, and published.
- **Exit criterion:** all three documents carry a **non-draft** status, every `[PLACEHOLDER]` is
      resolved, and they are linked from the onboarding/storefront surfaces. No merchant is onboarded
      and no customer order is taken against a document still headed
      *"DRAFT — NOT LEGAL ADVICE — REQUIRES REVIEW BY QUALIFIED COUNSEL."*
- **Where it stands:** all three exist as **counsel-ready drafts** (`Version 0.1 — Draft for counsel
      review`) that close GAP-02 as far as engineering can — the structure, clause-to-requirement
      tracing (`WEB-06`, `PAY-07`, `PAYINT §1`), and the two-jurisdiction framing are done. What
      remains is the legal review itself, which is gated on A1.
- **Reference:** [`legal/TERMS_OF_SERVICE.md`](./legal/TERMS_OF_SERVICE.md),
      [`legal/PRIVACY_POLICY.md`](./legal/PRIVACY_POLICY.md),
      [`legal/MERCHANT_AGREEMENT.md`](./legal/MERCHANT_AGREEMENT.md).

### A3. PostgreSQL + Row-Level Security enabled (DB-02, DB-04, PLAT-05)

- [ ] **Gate:** production runs on **managed Postgres**, and Postgres **RLS** (the second, engine-level
      tenancy layer) is enabled and forced on every tenant-scoped table.
- **Exit criterion:** production `DATABASE_URL` points at managed Postgres with `sslmode=require`; the
      app connects as a **non-owner, non-superuser** role; the RLS migration is applied so every
      tenant-scoped table has `ENABLE` + `FORCE ROW LEVEL SECURITY` and a `tenant_isolation` policy
      keyed to the per-request `app.org_id` GUC; and an unscoped connection provably returns **zero
      rows** (fail-closed). Staging runs the same engine (`PLAT-01/02`) so a Postgres-only bug cannot
      slip through a smaller, different-shaped environment.
- **Where it stands:** the schema is **Postgres-portable by design** (status/enums are `String`+Zod,
      JSON is TEXT, money is integer minor units — none of which change across engines), a verbatim
      [`schema.postgres.prisma`](../packages/db/prisma/schema.postgres.prisma) ships, and the exact
      RLS SQL (per-table policies, the `EXISTS` policies for the three parent-inheriting child tables,
      the `set_config('app.org_id', …, true)` transaction wiring) is written out ready to apply. This
      is a swap-and-apply, not a build.
- **Reference:** [`POSTGRES.md`](./POSTGRES.md) (Part 1 the swap, Part 2 RLS).

### A4. Real Auth0 wired (Auth-Flow, AUTHZ-03, PLAT-01)

- [ ] **Gate:** Tier-1 identity is served by **Auth0** (Universal Login + device-scoped refresh
      tokens), one Auth0 tenant per environment, replacing the self-contained HS256 JWT that stands in
      today.
- **Exit criterion:** production login goes through Auth0; the `organizationId` / `role` /
      `locationIds` claims are injected by the Auth0 Action (`AUTHZ-03`) and remain the **only**
      server-side source of tenant/role (never the request body, `BE-10`); the dev placeholder secret
      `shopmaster-dev-secret-change-me` exists nowhere in any real environment. Tier-2 offline PIN
      (`verifyPin`, bcrypt, zero-connectivity) is unchanged — it must keep working on an offline
      device.
- **Where it stands:** two-tier auth is **implemented and running**; the Tier-1 JWT is deliberately
      **Auth0-swappable** so the whole system runs with no external IdP today, and swapping it changes
      one layer (`packages/core/src/auth.ts`). Auth0 client secrets are already accounted for in the
      secrets-manager gate (A8).
- **Reference:** [`operations/SECURITY.md`](./operations/SECURITY.md) §5,
      [`02-architecture/Shopmaster_Platform_Architecture.md`](./02-architecture/Shopmaster_Platform_Architecture.md)
      PLAT-01.

### A5. Live payment rails: Cash + Tyro EFTPOS + NepalQR/Fonepay (PAYINT §8 Phase-1 sequence, PAY-04)

- [ ] **Gate:** the Phase-1 rail set is on **live** (non-mock) adapters — **Cash** (both markets),
      **Tyro EFTPOS** (Australia in-person), **NepalQR via Fonepay** (Nepal in-person) — in the
      PAYINT ease-of-integration order (Cash → Tyro → Fonepay).
- **Exit criterion:** each non-cash adapter authorizes and captures against the real processor with
      the **merchant's own credentials** (funds settle to the merchant's own account — ShopMaster
      never pools money, `PAYINT §1`); the `mock` flag is **false** in production for these rails and
      is surfaced as `false` in metrics (so live-rail health is never confused with mock traffic,
      `OBSERVABILITY.md` §3.2); and the `PAY-07` tokenization boundary is intact — adapters return
      **only a processor token**, never a PAN/CVV. `railsForCurrency` still gates rails per market
      (NPR → `CASH, FONEPAY, …`; AUD → `CASH, TYRO`) and **no crypto rail is ever selectable for an
      NPR merchant** (`PAYINT §6.1`, hard legal wall).
- **Where it stands:** **Cash is already the real adapter** and involves no card data by definition;
      Fonepay/eSewa/Khalti/Tyro ship as clearly-labelled **mock/sandbox** adapters (no network, no real
      money). Going live is replacing **one adapter's body per rail** — the tokenization boundary does
      not move, so a new rail cannot widen what ShopMaster stores.
- **Reference:** [`05-payments/Shopmaster_Payment_Integration.md`](./05-payments/Shopmaster_Payment_Integration.md)
      §7–§8, [`operations/SECURITY.md`](./operations/SECURITY.md) §1.

### A6. Multi-tenancy isolation suite green (GAP-05, BE-10/11, DB-03)

- [ ] **Gate:** a **dedicated** multi-tenant isolation test suite exists and is green in CI against
      Postgres.
- **Exit criterion:** the suite proves, across every tenant-scoped endpoint, that a token for org A
      cannot read, mutate, or even confirm-the-existence-of any org B record (cross-tenant reads
      return **404, not 403**, so probing can't confirm a record exists, `GAP-05`); it exercises
      **both** tenancy layers — the app-layer `tenancy.ts` guard **and** Postgres RLS (A3) — and
      confirms an unscoped DB connection sees nothing. The Platform Architecture named this as
      *"worth a dedicated test suite, not just code review."*
- **Where it stands:** isolation is **implemented** at the API boundary and in `tenancy.ts`
      (`TenantViolationError`, fail-loud); the *dedicated test strategy* is the named, unbuilt gap.
      Observability already treats a cluster of cross-tenant `403`/`404`s as a **critical** alert
      (`OBSERVABILITY.md` §4), so this gate and A7 reinforce each other.
- **Reference:** [`../NEXT_STEPS.md`](../NEXT_STEPS.md) GAP-05,
      [`operations/SECURITY.md`](./operations/SECURITY.md) §2.

### A7. Sync-conflict suite green (GAP-06, DB-06..DB-10, SYNC-04)

- [ ] **Gate:** a test suite that exercises the offline event-log conflict resolution under **real
      concurrent-edit** conditions exists and is green.
- **Exit criterion:** the suite scripts genuine cross-device concurrent edits to the same order and
      asserts the deterministic outcome — earliest device timestamp wins, the losing edit **preserved
      in the audit trail** rather than dropped (`DB-09`) — and asserts idempotency under retried sync
      (a replayed queued event cannot double-apply, `BE-04`, unique `idempotencyKey`). This is exactly
      the logic that "works fine in every manual test and fails only under conditions nobody thought to
      script."
- **Where it stands:** event replay + the DB-09 conflict case are **unit-tested** already; GAP-06 is
      the broader, adversarial concurrent-edit strategy on top of that. The restore drill (A6-adjacent,
      see A9) also re-verifies replay correctness on restored data.
- **Reference:** [`../NEXT_STEPS.md`](../NEXT_STEPS.md) GAP-06.

### A8. Secrets in a dedicated manager, not env files (PLAT-14)

- [ ] **Gate:** every secret lives in a **dedicated secrets manager**, injected as env vars at deploy
      time — not committed, not pasted into a deploy dashboard, not baked into an image.
- **Exit criterion:** `JWT_SECRET`, the production `DATABASE_URL` (it carries Postgres credentials),
      the Auth0 client secrets (A4), and the live payment-processor keys (A5) all resolve from the
      manager; the dev default `shopmaster-dev-secret-change-me` is overridden everywhere; the secrets
      manager's own recovery path is backed up independently of the database (`DISASTER_RECOVERY.md`
      §1). `PAY-07` is only as strong as the weakest secret-handling practice around it.
- **Where it stands:** the discipline is **enforced today** — `.dockerignore` keeps every `.env` out
      of the build context, and the `.env.example` files carry **placeholders only**. What remains is
      pointing production at a real manager.
- **Reference:** [`operations/SECURITY.md`](./operations/SECURITY.md) §7,
      [`DEPLOYMENT.md`](./DEPLOYMENT.md) §7.

### A9. Backups automated **and restore-tested** (PLAT-15)

- [ ] **Gate:** automated Postgres backups run, and a **restore has actually been performed and
      verified** — not merely configured.
- **Exit criterion:** daily snapshots + PITR (continuous WAL archiving) are on; the restore drill has
      been run into an **isolated** environment and recorded in the DR log with a **measured**
      restore time; verification proved **integrity, not existence** — row counts match, **event
      replay reproduces the same materialized orders** (`DB-06..DB-10`), multi-tenant isolation still
      holds on restored data, money is intact as integer minor units, and a device with queued events
      re-syncs idempotently into the restored DB. "A backup that has never been restored is a
      hypothesis, not a backup."
- **Where it stands:** the full backup mechanism and the step-by-step tested-restore drill are
      **documented and ready to run** against managed Postgres; they are wired up at the point real
      production data exists. (RPO/RTO targets — proposed `< 1 hour` / `< a few hours` — are a
      **fast-follow** sign-off, F6, because the drill *measures* them.)
- **Reference:** [`operations/DISASTER_RECOVERY.md`](./operations/DISASTER_RECOVERY.md) §2–§3.

### A10. Observability alerts set **before** launch (PLAT-13, PLAT-12)

- [ ] **Gate:** structured logging, metrics, and error tracking are stood up, and alert thresholds are
      **pre-set against the ShopMaster-specific metrics** — not added reactively after the first
      incident.
- **Exit criterion:** the three pillars exist; the three product-specific metrics emit — **sync queue
      depth per device *and* per location**, **payment success/failure per rail** (`mock`-tagged), and
      **public QR/online latency + 429s watched separately from staff traffic**; and the §4 alerts are
      live, including the **critical** ones: rail-hard-down, and a cluster of cross-tenant `403`/`404`s
      (a security signal, `GAP-05`). Logs carry `requestId` + `organizationId` and **never** personal
      data, secrets, or token bodies.
- **Where it stands:** the application already emits the **signals** these metrics are computed from
      (sync-state endpoint, per-rail payment path, rate-limited public routes); the metric definitions
      and starting thresholds are the delivered artifact. Collection, dashboards, and wiring stand up
      at deploy time.
- **Reference:** [`operations/OBSERVABILITY.md`](./operations/OBSERVABILITY.md) §3–§4.

### A11. Merchant onboarding <15 min, verified (GAP-07, PRD §5)

- [ ] **Gate:** the self-serve onboarding flow exists and hits the PRD's headline success metric —
      **15 minutes from signup to first QR order, zero hardware purchased.**
- **Exit criterion:** a first-time merchant (tea-stall persona, no training) completes signup →
      capability/tier resolution → menu seed → device pairing (`Auth-Flow`) → payment-account linking
      (A5) → a live QR order, **timed under 15 minutes** in a real run. Until the flow is built and
      timed, a **concierge/assisted onboarding** path (F-note below) is the only way a supervised pilot
      merchant goes live.
- **Where it stands:** the runtime pieces onboarding *composes* exist (capability manifest, device
      pairing, QR entry, storefront), but the **flow itself is the single most-postponed deliverable**
      and is **not built**. It is also the input the unit-economics support-cost line is most sensitive
      to (`UNIT_ECONOMICS.md`).
- **Reference:** [`../NEXT_STEPS.md`](../NEXT_STEPS.md) GAP-07.

> **Blocking-gate note on onboarding.** A11 blocks **self-serve GA**. A small, hand-held **concierge
> pilot** (ShopMaster staff onboard each merchant manually) can proceed with A1–A10 green and A11 open
> — but the 15-minute self-serve number is the product premise and must close before general
> availability, not after.

---

## Part B — Fast-follow gates (launch proceeds; close on a named clock)

These are real work, but a controlled, in-person-first pilot can run without them for a bounded
window. Several are **threshold-triggered** — they only become due when a specific condition (scale,
a Nepal audit threshold, `WEB` going live) is actually hit.

### F1. Final Growth pricing set (GAP-03)

- [ ] Resolve every `[PRICE TBD, GAP-03]` in the Merchant Agreement and pricing sheet before any
      **paid Growth** merchant is billed. A **free/near-free Starter** pilot can launch first, since
      Starter is specified as free-or-near-free (`PRD §9`). Illustrative economics and prices already
      ship in [`business/UNIT_ECONOMICS.md`](./business/UNIT_ECONOMICS.md) and
      [`business/PRICING.md`](./business/PRICING.md) as assumptions to validate against real cohort
      data — which itself needs A11 (onboarding) live.

### F2. Online payment rails, alongside `WEB` going live (PAYINT §8)

- [ ] Tyro eCommerce **or** Stripe (Australia online) and eSewa + Khalti merchant gateways (Nepal
      online) go live **when the online-checkout channel does** — deliberately after the Phase-1
      in-person rails (A5), not before. Same tokenization boundary, one adapter body each.

### F3. Notifiable Data Breach plan counsel-confirmed (GAP-10)

- [ ] The breach-response plan (already written, closes GAP-10) is confirmed by Australian-licensed
      privacy counsel alongside the Privacy Policy (A2), before genuine customer data exists **at
      scale**. The plan, roles, and the `serious harm` assessment path already ship in
      [`operations/DATA_BREACH_RESPONSE.md`](./operations/DATA_BREACH_RESPONSE.md); the counsel
      confirmation rides the same lawyer as A2.

### F4. Hardware compatibility list certified (GAP-09)

- [ ] Turn the **candidate** known-good printer/card-reader list into a **certified** per-market list
      by actually testing the devices. Not a launch-day blocker because the zero-hardware Starter path
      (`HW-01`, PWA on one phone) needs no certified peripheral. Candidate list ships in
      [`operations/HARDWARE_COMPATIBILITY.md`](./operations/HARDWARE_COMPATIBILITY.md).

### F5. Trademark clearance on "ShopMaster" (GAP-11)

- [ ] Clear and register the name in Nepal and Australia. Legal risk to resolve on a clock, not a
      day-one technical blocker; the Terms and Merchant Agreement already flag the name as
      not-yet-cleared.

### F6. RPO / RTO signed off (PLAT-16)

- [ ] The proposed `RPO < 1 hour` / `RTO < a few hours` targets get **business sign-off** — engineering
      alone should not finalize them — and are **validated against the measured restore time** from the
      A9 drill (the measurement wins over the aspiration). Proposals ship in
      [`operations/DISASTER_RECOVERY.md`](./operations/DISASTER_RECOVERY.md) §4.

### F7. Go-to-market motion (GAP-12)

- [ ] A concrete GTM plan for how a merchant not already talking to Bidur finds and signs up. Strategy
      and channel notes ship in [`business/GTM.md`](./business/GTM.md); execution follows launch.

### F8. Scale-out infrastructure — Redis/BullMQ + distributed rate limiting (BE-03, BE-13, PLAT-04)

- [ ] Replace the in-process event emitter (`core/events/emitter.ts`) with Redis/BullMQ, and back the
      public-endpoint rate limiter with Redis so limits span the horizontally-scaled API instances
      (the in-memory map is per-instance today — a documented Phase-1 limitation, not a design flaw).
      When the queue lands, its depth/job-failure metrics join `OBSERVABILITY.md` §3 as a fourth
      first-class signal. **Scale-triggered**, not launch-blocking for pilot traffic.

### F9. Nepal IRD/CBMS in-country audit server (LOC-03/04, PLAT-07/08)

- [ ] Provision the one-way, narrow CBMS replica **only when a qualifying Nepal merchant crosses the
      LOC-03/04 threshold** — it does not exist before that trigger and recovers by re-seeding from the
      primary. **Threshold-triggered**, documented, not built.

### F10. Native iOS/Android packaging (HW-01, FE-01/02)

- [ ] Native React Native packaging is the productionization step over the PWA that ships today. The
      web/PWA is the Phase-1 delivery vehicle; native follows when a real platform requirement
      (kiosk OS-lockdown `FE-08`, store presence) drives it.

> **Explicitly out of scope, not fast-follow:** any Web3 / crypto payment rail. It sits deliberately
> outside every phase (`PAYINT §8`), is ruled out entirely for Nepal (`PAYINT §6.1`, a hard legal
> wall enforced in code), and is revisited only once the Australian regulatory transition settles —
> never scheduled onto this checklist.

---

## Summary

| # | Gate | IDs | Bucket | Ready to close from |
|---|---|---|---|---|
| A1 | Legal entity decided | GAP-01 | **Blocking** | (decision — upstream of all legal) |
| A2 | Legal docs counsel-reviewed | GAP-02 | **Blocking** | `legal/*` drafts |
| A3 | Postgres + RLS enabled | DB-02/04, PLAT-05 | **Blocking** | `POSTGRES.md` |
| A4 | Real Auth0 wired | Auth-Flow, AUTHZ-03 | **Blocking** | `SECURITY.md` §5 |
| A5 | Live rails: Cash + Tyro + Fonepay | PAYINT §8, PAY-04/07 | **Blocking** | Payment Integration §7–§8 |
| A6 | Multi-tenancy isolation suite green | GAP-05, BE-10/11 | **Blocking** | (suite to build) |
| A7 | Sync-conflict suite green | GAP-06, DB-06..10 | **Blocking** | (suite to build) |
| A8 | Secrets in a manager | PLAT-14 | **Blocking** | `SECURITY.md` §7 |
| A9 | Backups automated + restore-tested | PLAT-15 | **Blocking** | `DISASTER_RECOVERY.md` §2–3 |
| A10 | Observability alerts pre-set | PLAT-12/13 | **Blocking** | `OBSERVABILITY.md` §3–4 |
| A11 | Onboarding <15 min verified | GAP-07 | **Blocking** (GA) | (flow to build) |
| F1 | Final Growth pricing | GAP-03 | Fast-follow | `UNIT_ECONOMICS.md`, `PRICING.md` |
| F2 | Online payment rails | PAYINT §8 | Fast-follow | Payment Integration §8 |
| F3 | NDB plan counsel-confirmed | GAP-10 | Fast-follow | `DATA_BREACH_RESPONSE.md` |
| F4 | Hardware list certified | GAP-09 | Fast-follow | `HARDWARE_COMPATIBILITY.md` |
| F5 | Trademark clearance | GAP-11 | Fast-follow | (external check) |
| F6 | RPO/RTO signed off | PLAT-16 | Fast-follow | `DISASTER_RECOVERY.md` §4 |
| F7 | GTM motion | GAP-12 | Fast-follow | `GTM.md` |
| F8 | Redis/BullMQ + distributed rate limit | BE-03, BE-13 | Fast-follow (scale) | `OBSERVABILITY.md` §6 |
| F9 | Nepal IRD/CBMS audit server | LOC-03/04, PLAT-07/08 | Fast-follow (threshold) | Platform Arch |
| F10 | Native app packaging | HW-01, FE-01/02 | Fast-follow | `CODE_MAP.md` |

**Go-live rule of thumb:** all of **A1–A10** green is the bar for a **supervised, concierge-onboarded
pilot**; **A11** additionally green is the bar for **self-serve general availability**. Everything in
Part B is real, tracked, and on a named clock — but none of it is a reason to hold the pilot.
</content>
</invoke>
