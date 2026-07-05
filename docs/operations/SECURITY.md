# ShopMaster — Security

The security controls ShopMaster relies on, mapped to where each one actually lives in the code.
This is the control-side companion to [`DATA_BREACH_RESPONSE.md`](./DATA_BREACH_RESPONSE.md) (what to
do when a control fails) and [`OBSERVABILITY.md`](./OBSERVABILITY.md) (how a failing control is
detected). Requirement IDs reference the PRD, the
[Backend Architecture](../02-architecture/Shopmaster_Backend_Architecture.md), and the
[Platform Architecture](../02-architecture/Shopmaster_Platform_Architecture.md).

Covers: payment tokenization (**PAY-07**), secrets management (**PLAT-14**), role-based access
control (**STAFF-01**), the audit trail (**ADMIN-07**), public-endpoint rate limiting (**BE-13**),
and JWT/session handling (**Auth-Flow**).

> **What is real vs. what stands in.** The RBAC matrix, the audit trail, the rate limiter, the
> tokenization boundary, and JWT session handling are all **implemented and running** (see
> [`CODE_MAP.md`](../CODE_MAP.md)). Two production hardening steps stand behind their real
> interfaces: Auth0 (a self-contained HS256 JWT stands in — §5) and a dedicated secrets manager (the
> discipline is documented and the `.env` hygiene is enforced — §7). Both are swap-one-layer changes,
> not re-architectures, and are flagged as such throughout.

---

## 1. Payment tokenization — no raw card data, by construction (PAY-07)

**No raw card data ever reaches ShopMaster storage.** The payments abstraction
(`packages/core/src/payments/index.ts`, BE-07..BE-09) is one interface —
`authorize / capture / refund / getStatus` — with one adapter per rail, and adapters return **only a
processor token**, never a PAN, CVV, or stripe. The order service calls the abstraction; it never
sees card material. This is the single most important security property in the product, because it
takes the highest-harm breach category off the table *architecturally* rather than by policy:

- The `PaymentResult` type carries a `processorToken?`, a status, and a `mock` flag — and nothing
  that is card data.
- Adding a live rail is replacing **one adapter's body**; the tokenization boundary does not move, so
  a new rail cannot accidentally widen what ShopMaster stores.
- Every non-cash adapter today is a clearly-labelled **mock/sandbox** — no network, no real money
  (the mock status is surfaced right through to metrics, `OBSERVABILITY.md` §3.2). Cash is the only
  real adapter and by definition involves no card data at all.
- **No Web3 adapter exists**, and by construction no crypto rail is ever selectable for an NPR (Nepal)
  merchant (`railsForCurrency`, Payment-Integration §6.1) — a hard legal wall, enforced in code, not a
  guideline.

The consequence for incident response is spelled out in `DATA_BREACH_RESPONSE.md` §1: a card-data
breach of ShopMaster's own systems is out of scope *by design*. Keeping PAY-07 true is a
launch-blocking invariant.

---

## 2. Multi-tenancy isolation (BE-10/11, DB-02/03) — the boundary everything else assumes

Every request carries a validated `TenantContext` derived from the JWT
(`apps/api/src/auth-middleware.ts`) — `organizationId` and `locationIds` come from signed claims,
**never from the client body.** Every model carries `organizationId` and queries are scoped through
`packages/core/src/tenancy.ts`. A cross-tenant read returns **404, not 403** (GAP-05), so probing
cannot even confirm another tenant's record exists. This is not, strictly, one of the six named
controls in this doc — but it is the boundary the audit trail, rate limiting, and breach-scoping all
lean on, which is why a cluster of cross-tenant `403`/`404`s is a **critical** alert in
`OBSERVABILITY.md` §4. Its dedicated test strategy is tracked as GAP-05.

---

## 3. Role-based access control (STAFF-01)

RBAC lives in one place — `packages/shared/src/permissions.ts` — shared by the API and web client so
the two cannot drift (BE-01). Ten discrete permissions gate the sensitive actions:

`order.take · order.pay · order.void · order.discount · order.refund · kitchen.view · reports.view ·
menu.manage · staff.manage · settings.manage`

Mapped to five roles:

| Role | Gets |
|---|---|
| **OWNER** | all permissions |
| **MANAGER** | everything except `staff.manage` |
| **CASHIER** | `order.take`, `order.pay`, `kitchen.view` |
| **WAITER** | `order.take`, `kitchen.view` |
| **KITCHEN** | `kitchen.view` only |

Enforcement is server-side at the route boundary — `requirePermission(...)` in
`apps/api/src/auth-middleware.ts` reads the role from the validated context and throws `403 Missing
permission: <x>` if the matrix denies it. The client uses the same matrix to *hide* controls, but the
**server is the authority** — a hidden button is a UX nicety, the `403` is the control. The money-
and audit-sensitive actions (`order.void`, `order.discount`, `order.refund`, `settings.manage`) are
exactly the ones that also write the audit trail (§4).

---

## 4. Audit trail (ADMIN-07)

`AuditLogEntry` (`packages/db/prisma/schema.prisma`) is the **full, append-oriented audit trail —
every discount, void, refund, and config change.** Fields: `organizationId`, `actorId`, `action`,
`target`, `before`/`after` (JSON stored as TEXT on SQLite, `jsonb` on Postgres), `deviceId`,
`createdAt`, indexed by `(organizationId, createdAt)`. It serves two jobs:

- **Accountability** — who did the sensitive thing, when, on what device, and what changed
  (before → after). Written by the sensitive paths: menu changes (`packages/core/src/menu.ts`) and
  the sensitive order actions.
- **Conflict forensics (DB-09)** — when the offline event-log merge resolves a genuine cross-device
  conflict (earliest device timestamp wins), the **losing edit is preserved** in the audit trail
  rather than silently dropped (`packages/core/src/order/service.ts`, `replay.ts`). The audit trail is
  how "we didn't lose your edit, we recorded that it was superseded" is actually true.

It is also the **first artefact a data-breach assessment reaches for** (`DATA_BREACH_RESPONSE.md`
§6) — the immutable technical record beside the human incident register.

---

## 5. JWT / session handling (Auth-Flow)

Two-tier auth (`packages/core/src/auth.ts`):

- **Tier 1 — online login (owner/manager).** Email + password (bcryptjs hash) mints a signed JWT
  carrying `sub`, `name`, `role`, `organizationId`, `locationIds` (BE-10). Signed **HS256** with
  `jose`; default **12-hour** expiry. In production this is Auth0's Universal Login + a device-scoped
  refresh token — the current self-contained JWT is **Auth0-swappable** so the whole system runs with
  no external identity provider, and swapping it in changes one layer.
- **Tier 2 — offline PIN.** Staff select their name and enter a PIN checked against a locally-cached
  bcrypt hash with **zero connectivity** (Auth-Flow B2/B3, `verifyPin`). This is what makes staff
  switching work on a device that is offline — the offline-first property (`DISASTER_RECOVERY.md` §1)
  reaching all the way into auth.

Handling rules:

- The signing key is `JWT_SECRET`, injected from the secrets manager (§7) — the dev default
  (`shopmaster-dev-secret-change-me`) is explicitly a placeholder that **must** be overridden in every
  real environment. A leaked or default secret lets anyone mint tokens for any tenant; rotating it is a
  Phase-1 containment step in `DATA_BREACH_RESPONSE.md` §3.
- The token is the **only** source of tenant/role claims server-side — an invalid or absent token is
  treated as unauthenticated and `requireAuth` rejects it; claims are never taken from the request
  body.
- Passwords and PINs are **bcrypt-hashed, never stored or logged in plaintext** (`OBSERVABILITY.md`
  §2 forbids logging hash or secret material).

---

## 6. Credential storage

Passwords and PINs are hashed with **bcryptjs** (`hashPassword` / `hashPin`, a pure-JS implementation
with no native build). Plaintext credentials exist only transiently in the request that verifies them
and are never persisted or logged. Because the PIN hash is *cached on-device* for offline Tier-2 auth,
a lost/stolen device is a scenario the breach plan names explicitly (`DATA_BREACH_RESPONSE.md` §5) —
hashes are not plaintext, but the device-loss assessment is a real one.

---

## 7. Secrets management (PLAT-14)

Every secret — `JWT_SECRET`, the production `DATABASE_URL` (it carries Postgres credentials), and
later the Auth0 client secrets and live payment-processor keys — lives in a **dedicated secrets
manager**, injected as environment variables at deploy time. **Not** committed to the repo, **not**
pasted into a deploy dashboard by hand, **not** baked into an image. Enforced today by:

- `.dockerignore` keeping every `.env` out of the build context (`DEPLOYMENT.md` §7).
- `.env.example` files carrying **placeholders only**.
- Secrets backed up independently of the database, never inside a DB dump
  (`DISASTER_RECOVERY.md` §2).

PAY-07's promise that no raw card data touches ShopMaster's storage (§1) **is only as strong as the
weakest secret-handling practice around it** — the tokenization boundary and the secrets discipline
are one control, not two.

---

## 8. Public-endpoint rate limiting (BE-13)

The public, unauthenticated QR/NFC and online-ordering endpoints are the only ones that accept
requests with **no staff authentication**, so they carry their own per-session rate limiting
(`apps/api/src/rate-limit.ts`, applied in `apps/api/src/routes/public-orders.ts`):

| Endpoint | Limit | Key |
|---|---|---|
| `POST /public/orders` (create) | 30 / min | per caller (IP) |
| `POST /public/orders/:id/events` | 60 / min | **per order token**, not per IP |

**Keying event traffic by order token, not IP, is deliberate** — a busy restaurant's whole floor
shares one NAT'd IP, so IP-keying would throttle legitimate diners together; the table/session token
is the correct unit of "one customer's order." Over the limit throws `429`. In production this
becomes Redis-backed (the in-memory map is per-instance and does not span the horizontally-scaled
API instances of PLAT-04 — a documented Phase-1 limitation, not a design flaw). The `429` rate is a
first-class abuse signal in `OBSERVABILITY.md` §3.3/§4.

---

## 9. Summary — control → code

| Control | Requirement | Where |
|---|---|---|
| Payment tokenization | PAY-07 | `packages/core/src/payments/index.ts` |
| Tenant isolation | BE-10/11, DB-02/03, GAP-05 | `apps/api/src/auth-middleware.ts`, `packages/core/src/tenancy.ts` |
| RBAC | STAFF-01 | `packages/shared/src/permissions.ts`, `requirePermission` |
| Audit trail | ADMIN-07 | `AuditLogEntry`; `menu.ts`, `order/service.ts` |
| JWT / two-tier session | Auth-Flow | `packages/core/src/auth.ts` |
| Credential hashing | Auth-Flow | bcryptjs in `auth.ts` |
| Secrets management | PLAT-14 | secrets manager; `.dockerignore`, `.env.example` |
| Public rate limiting | BE-13 | `apps/api/src/rate-limit.ts`, `routes/public-orders.ts` |
