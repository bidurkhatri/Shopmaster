# Shopmaster — Backend Architecture

| | |
|---|---|
| **Product** | Shopmaster |
| **Document type** | Sub-system design — Backend |
| **Version** | 0.1 — Draft for review |
| **Date** | 2 July 2026 |
| **Prepared by** | Bidur |
| **Builds on** | PRD Section 12, System Architecture diagram (`CORE`, `SHARED` nodes) |

## 1. Scope

This is what actually runs inside the `BACKEND` box from the system architecture diagram — service boundaries, API shape, how the Core Commerce Engine and Shared Services are really structured, and the sync/reconciliation logic that makes SYNC-01 through SYNC-05 true rather than aspirational. IDs here: `BE-##`.

## 2. Stack

- **BE-01 — Node.js + TypeScript.** Not a default so much as a fit: it's an I/O-heavy API workload (lots of small requests, not heavy computation), it's the same language the frontend runs, which means order/menu/pricing types get defined once and imported on both sides instead of drifting out of sync between two codebases — and it happens to be the stack Veridity already runs on (Express, NeonDB), so the Kathmandu team isn't context-switching languages between products.
- **BE-02 — REST over GraphQL for the transactional API, at least in v1.** GraphQL is tempting given how many channels read the same menu/order data, but REST resources map more directly onto the sync/queue model in Section 5 (`POST /orders`, `PATCH /orders/:id` are natural offline-outbox operations in a way a single GraphQL endpoint isn't), and it's simpler for a small team to reason about, cache, and debug. Worth revisiting a GraphQL layer specifically for admin/reporting once those read patterns get complex enough to justify it — that's an additive decision, not a rewrite.

## 3. Service Decomposition — Modular Monolith, Not Microservices (Yet)

One deployable backend application, internally organized into the modules below with real boundaries (own folder, own interface, no reaching into another module's internals) so it can be split into actual microservices later if a specific module's scale or security profile demands it. Full microservices from day one would be solving a scaling problem this product doesn't have yet, at the cost of the operational complexity a small team can't afford yet. Payments and Reporting are the two most likely first candidates to split out later — Payments because of its security perimeter, Reporting because of its different (read-heavy, analytical) load pattern.

Modules, matching the system architecture diagram directly:

| Module | Owns | Notes |
|---|---|---|
| Order Service | Order lifecycle, table/tab state | The one every channel writes to — see Section 4 |
| Menu Service | Catalog, modifiers, pricing rules, availability | Single source for MENU-04's instant 86 propagation |
| Pricing & Tax Engine | Line-item tax calculation | Jurisdiction-aware (LOC-02); pure calculation, no side effects, easy to unit test exhaustively |
| Payments Abstraction | Adapter interface + one adapter per rail | See BE-05 |
| Inventory | Stock deduction, reorder alerts | Phase 2, but the interface exists from v1 so Order Service doesn't need a breaking change to call it later |
| Staff & Roles | Auth0 sync, shift state, PIN table push | Talks to Auth0's Management API for the pieces that aren't pure token verification |
| CRM / Loyalty | Points, profile | Phase 2/3 |
| Reporting & Analytics | Aggregation, exports | Read-heavy, first split candidate |

## 4. Order Processing — Event-Emission, Not a Blocking Chain

Confirming an order shouldn't wait on inventory deduction, loyalty point accrual, or a reporting write — those are real but secondary effects, and none of them should be able to slow down or fail the primary "order confirmed" path. Order Service emits an internal event on every state change (`order.created`, `order.item_added`, `order.paid`, `order.closed`); Inventory, Reporting, and CRM subscribe independently. A lightweight queue (Redis-backed, e.g., BullMQ) is enough for this — there's no need for a heavier event-streaming platform at this scale, and introducing one would be over-building for a team this size.

The one thing that does sit in the critical path: kitchen ticket routing (`order.confirmed` → print/KDS dispatch). A customer or staff member is actively waiting on that one, so it's a direct call with retries, not a fire-and-forget event.

## 5. Sync & Reconciliation Engine

This is the module doing the actual work behind SYNC-01 through SYNC-05, and it deserves its own section because it's the part of the backend most unlike a typical CRUD API.

- **BE-03** Devices don't sync "current order state" — they sync a batch of timestamped, device-signed events (see Database Architecture DB-04 for why). The sync engine's job is to validate, order, and merge these batches, not to accept a client's claimed final state at face value.
- **BE-04** Every incoming event carries an idempotency key, so a retried sync after a dropped connection can't double-apply the same order edit.
- **BE-05** Merge conflicts (two devices editing the same order while both were offline) resolve via the event log itself — replaying events in a deterministic order rather than picking a winner between two competing "final states." Full mechanics live in the Database Architecture document, since this is really a data-model decision the backend enforces rather than a backend-only concern.
- **BE-06** The sync engine is also where SYNC-05's "always-visible sync status" gets its data — it exposes a per-device sync-state endpoint (queue depth, last successful sync timestamp) that the frontend polls or subscribes to.

## 6. Payments Abstraction

- **BE-07** One internal interface (`authorize`, `capture`, `refund`, `getStatus`), one adapter implementation per rail from PAY-04 — Nepal wallets, Australian card/bank rails, tap-to-pay, Bluetooth reader. Adding a new local rail is a new adapter behind the same interface, never a change to Order Service's payment-calling code.
- **BE-08** Each adapter is isolated enough that an outage or breaking API change in one rail can't take down another — a Fonepay incident shouldn't be able to break Australian card payments, and the interface is designed so that failure is a property of the adapter, not the abstraction layer.
- **BE-09** No raw card data ever reaches this layer's own storage — adapters call out to PCI-DSS-compliant processors and only ever store the returned token, per PAY-07.

## 7. Multi-Tenancy Enforcement

- **BE-10** Every request carries a validated JWT with `organization_id` and `location_ids` claims (from the Auth0 Action in AUTHZ-03). A single piece of middleware extracts these once, at the top of the request lifecycle, and makes them available to every downstream query — no individual endpoint handler should be trusted to remember to filter by tenant manually.
- **BE-11** Concretely: the ORM/query layer wraps every tenant-scoped table access so `organization_id` is injected automatically, rather than relying on each engineer to remember a `WHERE organization_id = ?` clause on every query they write. This is application-layer enforcement; Database Architecture DB-02 adds a second, independent layer underneath it. Neither layer alone is enough on its own — an app-layer bug shouldn't be the only thing standing between one merchant's orders and another's.

## 8. Background Jobs

- **BE-12** Queue-backed workers (same Redis/BullMQ infrastructure as Section 4) for: scheduled online orders (WEB-03) firing at their target time, report generation (RPT-01/02), SMS/WhatsApp sending (CRM-03), and the sync-reconciliation batch processing itself when volume makes inline processing impractical.

## 9. Public Endpoint Protection

- **BE-13** The QR/NFC ordering endpoint and the branded online-ordering endpoint are the only parts of this API that accept requests with no staff authentication at all. They need their own rate limiting (per table/session token, not just per IP, since a busy restaurant's whole floor can share one IP) and basic anomaly detection for order-spam, separate from the general API rate limits applied to authenticated traffic.

## 10. Open Questions

- Where's the actual line for splitting Payments or Reporting out of the monolith — a specific request-volume threshold, or a specific incident that would trigger it?
- Does the event-emission pattern in Section 4 need a dead-letter queue and alerting from day one, or is that reasonable to add once Inventory (Phase 2) makes downstream failures more consequential than they are for reporting alone?
- Should the Menu Service's 86-propagation (MENU-04) be push-based (webhook/event to every channel) or pull-based (channels poll on a short interval)? Push is faster and matches the "seconds, not minutes" goal in the PRD, but adds delivery-guarantee complexity worth weighing against just polling every few seconds.
