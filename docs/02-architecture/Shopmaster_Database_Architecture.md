# Shopmaster — Database Architecture

| | |
|---|---|
| **Product** | Shopmaster |
| **Document type** | Sub-system design — Data |
| **Version** | 0.1 — Draft for review |
| **Date** | 2 July 2026 |
| **Prepared by** | Bidur |
| **Resolves** | PRD SYNC-04 (flagged as an open architecture decision — resolved in Section 4 below) |

## 1. Scope

Two databases actually exist in this product, not one, and conflating them is where a lot of offline-first systems go wrong. This document covers both, how they relate, and the core entity model underneath the whole platform. IDs here: `DB-##`.

## 2. Two Layers

- **DB-01 — On-device: SQLite.** Runs on every staff device (POS, Kiosk), is the actual source of truth for an active session per SYNC-02, and is chosen specifically because it's universally supported, has a tiny footprint, and needs no server process — all of which matter directly against HW-02's 2GB RAM Android target.
- **DB-02 — Cloud: PostgreSQL.** The backend's database, source of truth once data has synced. Chosen for the same reasons as the Backend Architecture's stack pick: strong relational integrity for financial transaction data, mature JSON column support for the genuinely variable shape of menus and modifiers across a tea stall and a full restaurant, and Row-Level Security as a built-in feature this design leans on directly (Section 3) rather than as a nice-to-have.

## 3. Multi-Tenancy — Two Layers of Enforcement, Not One

- **DB-03** Every tenant-scoped table carries an `organization_id` column. This is the foundation everything else in this section sits on.
- **DB-04** Postgres Row-Level Security policies enforce `organization_id` filtering at the database engine itself, independent of and underneath the application-layer middleware described in Backend Architecture BE-10/11. This is a deliberate belt-and-suspenders decision: application-layer scoping alone means one overlooked query in one endpoint is a cross-tenant data leak, and RLS alone without application-layer awareness produces confusing query behavior that's hard to debug. Together, an engineer would have to make two independent mistakes at two different layers for one merchant to ever see another's data.
- **DB-05** `location_id` gets the same treatment as a second-level scope within `organization_id`, supporting AUTHZ-04's branch-manager-sees-one-location, owner-sees-all model directly at the data layer.

## 4. Order Sync & Conflict Resolution — Resolving SYNC-04

The original PRD flagged this explicitly as a decision that needed making before Phase 1, rather than left until it became a production incident. Here's the resolution:

- **DB-06 — Orders sync as an append-only event log, not a mutable row.** A device doesn't sync "the current state of order #123" — it syncs a sequence of discrete, timestamped, device-signed events: `item_added`, `item_removed`, `modifier_changed`, `payment_captured`, `order_closed`. The backend's actual order state is computed by replaying that event sequence, not by accepting whatever "final state" a device claims.
- **DB-07** Why this beats naive last-write-wins for something as consequential as a restaurant bill: if two tablets both add different items to the same open table while both are offline, last-write-wins on the whole order would silently drop whichever tablet's edits synced second. Event replay merges both sets of additions correctly, because the events themselves — not a snapshot — are what's being reconciled.
- **DB-08** Each event carries an idempotency key and a device ID, so a retried sync batch after a dropped connection can't double-apply an event, and every event is traceable to the specific device (and, via the local session, staff member) that generated it — which is also exactly the data ADMIN-07's audit trail needs, essentially for free.
- **DB-09** Genuine conflicts that can't merge cleanly (the same line item's quantity edited differently by two devices while both offline, for instance) resolve by event ordering — the event with the earliest device-local timestamp wins for that specific field — with the losing edit preserved in the log and visible in the audit trail rather than silently discarded. A manager can see it happened, even though the system picked automatically rather than asking a human at reconciliation time.
- **DB-10** The materialized "current order state" used for day-to-day reads (kitchen display, receipt, reporting) is a derived table, rebuilt from the event log — the event log is the durable source of truth, the materialized view is a performance optimization on top of it, and it's fine (in fact expected) to rebuild it if the derivation logic ever needs to change.

## 5. Core Entity Model

| Entity | Key fields (illustrative) | Notes |
|---|---|---|
| `Organization` | id, name, tier, branding | One per merchant tenant (AUTHZ-05) |
| `Location` | id, organization_id, address, tax_jurisdiction | LOC-02's tax engine keys off this |
| `StaffMember` | id, organization_id, auth0_user_id, role, pin_hash | `pin_hash` is what Tier 2 local auth checks against |
| `Device` | id, organization_id, location_id, last_seen, credential_fingerprint | Independently revocable per DEVICE-02 |
| `MenuCategory` / `MenuItem` / `Modifier` | organization_id, availability, multi-language fields | MENU-01/02/03 |
| `OrderEvent` | id, order_id, type, payload, device_id, staff_id, device_timestamp, idempotency_key | The append-only log from Section 4 |
| `Order` (materialized) | id, organization_id, location_id, table_id, status, computed_total | Derived, not authoritative |
| `TableOrTab` | id, location_id, status, opened_by | POS-03 |
| `Payment` | id, order_id, rail, processor_token, status | Never a raw card number, ever (PAY-07) |
| `AuditLogEntry` | actor_id, action, target, before, after, device_id, timestamp | ADMIN-07 |
| `InventoryItem` | organization_id, stock_level, reorder_point | Phase 2 |
| `CustomerProfile` | id, contact_method, opt_in_marketing | Phase 2/3, opt-in only per CRM-01 |

A companion ER diagram (`Shopmaster_Database_ERD.mermaid`) shows how these connect.

## 6. Nepal Audit-Server Data Flow

- **DB-11** The Nepal in-country component (Platform Architecture PLAT-07) receives a narrow, one-way replicated feed — just the `Payment` and `Order` fields that map to LOC-03's required invoice fields (PAN/VAT, invoice number, tax breakdown, timestamp) for Nepali merchants past the reported threshold. It is not a mirror of the full multi-tenant database, and it shouldn't become one by accretion over time without a deliberate decision to expand its scope.

## 7. Indexing

- **DB-12** The single most common query pattern in this whole system is almost certainly "today's orders at this location" — a composite index on `(organization_id, location_id, created_at)` on the materialized `Order` table earns its keep from day one, not as a later optimization.
- **DB-13** `OrderEvent` needs an index on `(order_id, device_timestamp)` to make replay itself fast, since that operation runs constantly, not occasionally.

## 8. Data Retention & Privacy

- **DB-14** Customer data deletion requests (the PRD's NFR on data privacy) use soft-delete followed by a scheduled hard-delete, rather than immediate hard-delete — immediate deletion makes it too easy for a mistaken or malicious request to be unrecoverable, and a short grace window costs little.
- **DB-15** `AuditLogEntry` retention is a separate, deliberately longer policy than customer PII retention — the audit trail's value is largely historical, and shortening it to match a customer-data policy would quietly weaken ADMIN-07 without anyone deciding that on purpose.

## 9. Open Questions

- What's the actual idempotency-key generation scheme for `OrderEvent` — device-generated UUID is the obvious default, but worth confirming it can't collide across devices or after an app reinstall.
- Does `InventoryItem` stock deduction (Phase 2) hook into the same event-log pattern as orders, or is a simpler mutable-row model defensible there given it's a lower-stakes, less conflict-prone data type than a bill?
- Backup/restore testing cadence (ties to Platform Architecture PLAT-15) — this document assumes it happens, but doesn't yet specify how often or who owns running it.
