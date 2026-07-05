# ShopMaster — Observability

Implements **PLAT-12** (structured logging, a metrics/monitoring stack, and error tracking, with the
short list of metrics that matter more here than in a typical SaaS) and **PLAT-13** (alerting
thresholds set against those metrics *before* launch, not added reactively after the first incident
that reveals nobody was watching). This is the operational build-out of §6 of the
[Platform Architecture](../02-architecture/Shopmaster_Platform_Architecture.md); it is what
[`DEPLOYMENT.md`](../DEPLOYMENT.md) §8 listed as "documented but not wired up." It pairs with
[`DATA_BREACH_RESPONSE.md`](./DATA_BREACH_RESPONSE.md) (detection is where a breach response starts)
and [`SECURITY.md`](./SECURITY.md).

> **Status.** The application already emits the *signals* these metrics are computed from — the sync
> endpoints (`GET /sync/state`), the per-rail payment path (`packages/core/src/payments`), and the
> rate-limited public endpoints (`apps/api/src/rate-limit.ts`) all exist. What this document
> specifies is the collection, dashboards, and thresholds layered on top. Consistent with the
> Phase-1 posture, that stack is described here and stood up at deploy time; the metric *definitions*
> and thresholds are the deliverable now.

---

## 1. Three pillars

| Pillar | What | Tooling category (vendor-neutral, like PLAT-03) |
|---|---|---|
| **Structured logging** | Machine-parseable JSON logs, one event per line, correlatable by request | Any structured-log pipeline the managed platform ships with |
| **Metrics / monitoring** | Time-series counters, gauges, histograms — the dashboards in §3/§4 | A Prometheus-style metrics + dashboard stack, or the platform's built-in equivalent |
| **Error tracking** | Aggregated, de-duplicated exceptions with stack traces and release tagging | A Sentry-style error tracker |

The specific vendor is deliberately left open — the same "name the category, not the product"
stance as the Platform Architecture's Open Questions. What is *not* optional is that all three exist
before launch.

---

## 2. Structured logging — the fields, and the hard rules

Every log line is JSON with a stable core set of fields so logs are queryable, not just readable:

| Field | Meaning |
|---|---|
| `timestamp`, `level` | ISO-8601, standard levels |
| `requestId` | Correlates every line for one request; generated at the API edge |
| `organizationId` | **The tenant dimension** — every log tied to the org it acted for (BE-10). Lets an incident be scoped to one merchant without leaking across tenants. |
| `route`, `method`, `status`, `durationMs` | The HTTP shape, feeding the latency metrics in §4 |
| `deviceId`, `staffId` | When present — the sync and audit dimensions |
| `railsafe` payment fields | `rail`, `result` status, `mock` flag — **never** an amount tied to an identifiable person, never a token secret |

**Hard rules — a log line is a place a breach can happen (see `DATA_BREACH_RESPONSE.md` §1):**

- **Never log personal information** — no customer name, phone, or delivery address in a log line.
  Reference the order by `id`, not by who placed it.
- **Never log secrets or credential material** — no `JWT_SECRET`, no `DATABASE_URL`, no bcrypt hash,
  no processor token body (PLAT-14, PAY-07). Log the *fact* of a payment and its `rail`/`result`, not
  its token.
- **Money in logs is integer minor units**, same as everywhere else — never a reformatted major-unit
  string, so a log figure is never ambiguous.

---

## 3. The ShopMaster-specific metrics (PLAT-12)

Three metrics matter more here than in a generic SaaS. These are the operational heart of this
document — a healthy generic dashboard can hide every failure that actually matters to this product.

### 3.1 Sync queue depth — per device *and* per location
The operational signal for **"is offline mode actually working"** — and it only works as a signal if
it is **not** averaged across the fleet. One device stuck at a growing queue depth while forty others
are at zero is invisible in a fleet average and obvious per-device.

- **Source:** the outbox drain (`apps/web/src/lib/outbox.ts`, FE-03/04) and the server's
  `GET /sync/state?deviceId=` (`{ pendingOnServer, lastSyncAt }`, SYNC-05).
- **Emit:** a gauge `sync_queue_depth{deviceId, locationId, organizationId}` and a
  `sync_last_success_age_seconds` per device.
- **Why per-location too:** a whole location climbing together points at that site's connectivity or a
  location-scoped bug; a single device climbing points at that device. Different problems, different
  fixes — the breakdown is what tells them apart.

### 3.2 Payment success / failure rate — per rail (PAY-04)
A silent failure in **one** local payment rail must surface immediately, **not get averaged away by
every other rail's healthy numbers.** Fonepay degrading while Cash, eSewa, and Khalti are fine is a
per-rail problem that a blended success rate erases.

- **Source:** the payments abstraction (`packages/core/src/payments/index.ts`) — every
  `authorize`/`capture` returns a `PaymentResult` with a status and a `mock` flag.
- **Emit:** counters `payment_attempts_total{rail, result, currency}` and
  `payment_failures_total{rail, currency}`; derive success rate per rail.
- **Rail set is market-scoped** (`railsForCurrency`): NPR → `CASH, FONEPAY, ESEWA, KHALTI`;
  AUD → `CASH, TYRO`. Cash is expected near-100% (it is local arithmetic, no network); the external
  rails are the ones a threshold watches.
- **Tag `mock`** so Phase-1 mock-adapter traffic is never mistaken for live-rail health once a real
  rail is wired in (the mock adapters are labelled as such in code and must be labelled as such in
  metrics).

### 3.3 Public QR / online endpoint latency — watched separately from staff traffic
The public, unauthenticated QR/NFC and online-ordering endpoints (BE-13) are **the surface most
exposed to abuse traffic skewing the numbers** — so their latency and error rates are a separate
dashboard from authenticated staff traffic. A DDoS or a scraper hammering `/public/orders` must not
be able to hide behind healthy staff-side p95s, and staff-side latency must not be polluted by public
abuse.

- **Source:** `durationMs` from the log fields (§2), split by whether the route is under the public
  router (`apps/api/src/routes/public-orders.ts`) or authenticated.
- **Emit:** `http_request_duration_seconds{surface="public|staff", route}` (histogram) and
  `http_requests_total{surface, route, status}`.
- **Watch the 429s specifically:** the rate limiter (`apps/api/src/rate-limit.ts`) throws `429` on
  the public endpoints (create: 30/min; per-order events: 60/min per order token). A rising
  `http_requests_total{surface="public", status="429"}` is the early-warning signal of abuse — track
  it as a first-class series, not a footnote.

---

## 4. Pre-set alert thresholds (PLAT-13)

Set **before launch**, against the specific metrics above — not added reactively after the first
incident. Starting values below; tune with real baseline traffic (they are deliberately conservative
so the first tuning is *loosening*, not discovering a gap).

| Alert | Metric | Proposed threshold | Severity |
|---|---|---|---|
| Device sync stalled | `sync_last_success_age_seconds` for a device | > 15 min while that device is active | Warning |
| Location sync degraded | share of a location's devices with rising `sync_queue_depth` | > 25% of the location's devices climbing for > 10 min | High |
| Rail failure spike | `payment_failures_total{rail}` rate (live, non-`mock`) | > 5% of that rail's attempts over 5 min | High |
| Rail hard-down | successful captures on a live rail | zero successes on an otherwise-active rail for 10 min | Critical |
| Public endpoint latency | public-surface p95 `http_request_duration_seconds` | p95 > 1s for 5 min | Warning |
| Public abuse / rate-limit surge | `http_requests_total{surface="public", status="429"}` | sustained spike vs. baseline (e.g. 10× 1-hr median) | High |
| API error rate | 5xx share across all routes | > 1% over 5 min | High |
| Unhandled exceptions | error-tracker new-issue rate | any new un-seen exception in prod | Warning (page on volume) |
| Tenant-isolation guard tripped | `403` cross-tenant denials (BE-10/11, GAP-05) | any sustained cluster — should be ~zero in normal use | Critical |

The last row is as much a **security** signal as an availability one: a cluster of cross-tenant `403`s
is a possible probing attempt and a trigger to consult [`DATA_BREACH_RESPONSE.md`](./DATA_BREACH_RESPONSE.md).

---

## 5. Health checks and release correlation

- **Liveness/readiness:** `GET /api/health` (already wired for the platform load balancer per
  `DEPLOYMENT.md` §4) is the platform's up/down probe — distinct from the deeper metrics here.
- **Tag every metric and error with the release/build** so a regression is attributable to a specific
  deploy (the immutable images promoted through the PLAT-10 pipeline). "It started at 14:03" is only
  useful if you can also say "…which is when build `abc123` went to production."

---

## 6. What this does not cover yet

Consistent with the Phase-1 status: the concrete vendor choices (metrics backend, error tracker) ride
the same open-question posture as hosting (PLAT-03). The **Redis/BullMQ** event bus is stubbed as an
in-process emitter today (BE-03, `core/events/emitter.ts`) — when it is introduced, queue depth and
job-failure metrics for it join §3 as a fourth first-class signal. The thresholds in §4 are starting
values to be tuned against real baseline traffic, in the same spirit as the RPO/RTO proposals in
[`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md) §4.
