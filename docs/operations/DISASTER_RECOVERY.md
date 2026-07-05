# ShopMaster — Disaster Recovery

Closes **PLAT-15** (automated backups with a genuinely *tested* restore procedure) and **PLAT-16**
(starting-proposal RPO/RTO targets for business sign-off). This is the operational counterpart to
§8 of the [Platform Architecture](../02-architecture/Shopmaster_Platform_Architecture.md) and the
recovery half of what [`DEPLOYMENT.md`](../DEPLOYMENT.md) §5 called "a launch requirement, not a
nice-to-have."

> **Two of the numbers here are proposals, not decisions.** Per PLAT-16, the RPO and RTO targets in
> §4 are illustrative starting points to open a conversation with whoever owns business risk
> tolerance — engineering alone should not finalize them. Everything else (the backup mechanism, the
> restore drill) is a concrete plan to implement against managed Postgres (PLAT-05); like the rest of
> the Phase-1 deploy story in `DEPLOYMENT.md`, it is documented here and wired up at the point real
> production data exists, not before.

---

## 1. What we are protecting, and the one thing that makes ShopMaster unusual

The authoritative store is **managed Postgres** (PLAT-05) — the materialized `Order` rows, the
append-only `OrderEvent` log they replay from (DB-06..DB-10), menu, staff, tenancy, and the
`AuditLogEntry` trail. That is the thing a disaster can lose, and the thing this document is about.

But ShopMaster has a genuine DR property most SaaS products do not: **it is offline-first by design.**
Every POS action is written to a device-local outbox *first* (`apps/web/src/lib/outbox.ts`, FE-03/04)
and drained to the server by a background worker when connectivity returns. Consequences for recovery:

- A **server-side outage does not stop a merchant trading.** Cash orders keep being taken on-device
  and queue locally; they sync when the server is back. The floor never stops.
- Device outboxes are an **independent, distributed copy of recent un-synced writes** — not a
  substitute for backups, but a real reason a short server-side data-loss window is far less
  catastrophic here than in a store-of-record-only system. Un-synced events survive on the devices
  that authored them and re-sync idempotently (BE-04: the unique `idempotencyKey` means replaying a
  queued event after recovery cannot double-apply).

This does not lower the bar on backups — it means the backup story and the sync story reinforce each
other, and the restore drill (§3) must account for devices re-syncing *into* a restored database.

| Asset | Backed up by | Notes |
|---|---|---|
| Postgres (all merchant + order + audit data) | Managed provider automated backups + PITR (§2) | The primary target of this plan |
| Secrets (`JWT_SECRET`, `DATABASE_URL`, processor keys) | Secrets manager, independently (PLAT-14) | A restored DB is useless without its secrets — back up the manager's recovery path too |
| Device outboxes (recent un-synced writes) | The devices themselves (IndexedDB) | Distributed redundancy, not a managed backup |
| Nepal in-country audit feed (PLAT-07) | Its own small host, when provisioned | One-way narrow CBMS replica; recovers independently, only exists once LOC-03/04 triggers |

---

## 2. Automated backups (PLAT-15)

Use the managed Postgres provider's built-in facilities rather than reinventing them — the whole
point of choosing managed Postgres (PLAT-05) was to make backups, point-in-time recovery, and
pooling the provider's problem:

- **Automated daily snapshots**, retained on a defined schedule (proposed: 7 daily / 4 weekly —
  confirm against the retention the business actually wants).
- **Point-in-time recovery (PITR)** via continuous WAL archiving, so recovery is not limited to the
  last nightly snapshot — this is what makes the sub-hour RPO in §4 achievable.
- Backups live in the **same primary region** chosen for Nepal/Australia latency (PLAT-06), with the
  provider's cross-region redundancy for the backups themselves where offered.
- **Secrets are backed up separately and never inside a database dump** (PLAT-14) — a dump that
  contained credentials would defeat the point.

A backup that has never been restored is a hypothesis, not a backup — which is the entire reason
PLAT-15 says *tested*.

---

## 3. The tested restore procedure (the point of PLAT-15)

**"Tested" means someone has actually run a restore and confirmed the data comes back correct — not
that a backup file exists.** The drill below is run on a **schedule (proposed: quarterly)** and after
any change to the schema or backup configuration, into an **isolated environment** — never against
production.

1. **Provision** a fresh isolated database instance (or a scratch project) — never the live one.
2. **Restore** the most recent snapshot, or PITR to a chosen timestamp, using the provider's restore
   flow. Record the wall-clock time this takes — that measured number is what validates the RTO in §4.
3. **Point a throwaway API instance** at the restored `DATABASE_URL` and bring it up
   (`Dockerfile.api`; the API is stateless — PLAT-04 — so this is just an env var).
4. **Verify integrity, not just existence.** This is the step that separates a real drill from
   theatre:
   - Row counts for `Order`, `OrderEvent`, `Payment`, `StaffMember`, `AuditLogEntry` match the
     pre-disaster baseline.
   - **Event replay reproduces the same materialized orders** — replaying the restored `OrderEvent`
     log (DB-06..DB-10) yields the same `Order`/`OrderItem` totals. This is the ShopMaster-specific
     integrity check: the store of record is the *log*, so a restore is only correct if replay is.
   - **Multi-tenancy isolation still holds** on the restored data — spot-check that a token for org A
     cannot read org B (BE-10/11, GAP-05). A restore must not silently reintroduce a cross-tenant leak.
   - Money values are intact as integer **minor units** — no silent truncation or unit drift.
5. **Rehearse device re-sync:** confirm that a device holding queued events can sync into the restored
   database and that idempotency (BE-04) prevents double-application of anything already persisted
   before the restore point.
6. **Record the drill** in the DR log: date, snapshot/timestamp used, measured restore time, and the
   verification results. A drill that is not written down did not happen.
7. **Tear down** the isolated environment.

The measured restore time from step 2 and the replay-verification from step 4 are the evidence that
the RTO/RPO proposals in §4 are real rather than aspirational.

---

## 4. RPO / RTO — starting proposals for sign-off (PLAT-16)

Flagged explicitly, per PLAT-16, as **a starting proposal for business sign-off, not a number this
document can responsibly finalize** — the right value depends on risk tolerance the engineering side
alone shouldn't decide.

| Objective | Proposed starting target | Why this is plausible here |
|---|---|---|
| **RPO** (max acceptable data loss) | **< 1 hour** | PITR with continuous WAL archiving makes sub-hour realistic; the offline outbox (§1) further shrinks *effective* loss, since recent un-synced writes survive on-device and re-sync. |
| **RTO** (max acceptable downtime) | **< a few hours** | Managed-provider restore + a stateless API that redeploys by pointing at the restored `DATABASE_URL` (PLAT-04); the measured drill time in §3 is what confirms or corrects this. |

Two honest caveats attached to these numbers:

- **They are unvalidated until the drill measures them.** The §3 restore drill produces the real
  restore-time figure; if it comes in above "a few hours," the RTO changes or the process does — the
  measurement wins, not the aspiration.
- **RPO is softened, not eliminated, by offline-first.** The outbox protects writes made *on a
  device*; it does nothing for server-side-only state or for a device that is itself lost. Sub-hour
  RPO still has to be earned by the backup configuration.

---

## 5. Scope, and what this does not cover yet

- **Regional failover / active-active** is out of scope for Phase 1 — the plan is *restore*, not
  *hot standby*. Consistent with PLAT-03/04's "managed platform first, not Kubernetes on day one"
  posture, standing up multi-region failover is a later graduation step, driven by a real availability
  requirement, not built speculatively.
- **The Nepal audit server (PLAT-07)** has its own trivial recovery story precisely because it is a
  one-way, narrow CBMS replica derived from the primary — if it is lost it is re-seeded from the
  primary, and it only exists once a qualifying merchant triggers LOC-03/04 (PLAT-08).
- **Provider selection is still open** (PLAT Open Questions) — this document specifies the *category*
  of capability (automated snapshots + PITR) required of whichever managed Postgres provider is
  chosen, the same way `DEPLOYMENT.md` names a hosting category rather than a vendor.
