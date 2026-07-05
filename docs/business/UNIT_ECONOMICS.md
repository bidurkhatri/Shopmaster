# ShopMaster — Unit Economics (cost to serve one merchant)

| | |
|---|---|
| **Product** | ShopMaster |
| **Document type** | Business model — cost-to-serve-one-merchant |
| **Version** | 0.1 — Draft for review |
| **Date** | 5 July 2026 |
| **Prepared by** | Bidur |
| **Status** | **DRAFT.** Closes **GAP-03**. Every number below is an **illustrative assumption to validate**, not a measured figure. |

Closes **GAP-03**. The Starter tier is specified as "free or near-free" (`PRD §9`) and individual
costs were flagged piecemeal across the earlier documents — Auth0 MAU pricing, the eSewa/Khalti/Tyro
rail fees, SMS/WhatsApp for `CRM-03` — but nothing was ever rolled up into an actual
cost-to-serve-one-merchant number. This document does that roll-up so that "free Starter" is a
decision backed by arithmetic instead of a hope.

> **Every figure here is illustrative and unvalidated.** Same posture as `LOC-06` and `PLAT-09`
> elsewhere in this repo: these are numbers to pressure-test with real vendor quotes and real usage
> data, not commitments. Three things make them soft on purpose: (1) **Auth0 is currently stubbed**
> — the self-contained JWT in `packages/core/auth.ts` stands in for it (`CODE_MAP → Auth-Flow`), so
> the identity cost below is a *future* cost, $0 today; (2) the **payment rails are mock adapters**
> (`PAYINT`, no real money), so per-rail fees are public-rate illustrations, not invoices; (3) the
> operating entity is undecided (`GAP-01`), which moves tax, support-labour, and FX assumptions.
> Prices in the [Merchant Agreement](../legal/MERCHANT_AGREEMENT.md) are deliberately left as
> `[PRICE TBD, GAP-03]` pending exactly this work. **Illustrative FX used throughout:**
> US$1 ≈ NPR 133 ≈ A$1.5.
>
> **Money convention.** In-system, every amount is stored as an **integer in minor units**
> (paisa / cents) per the platform-wide rule; the human-readable figures here are for planning only.

---

## 1. The one idea that makes "free Starter" possible

ShopMaster is a **multi-tenant** platform (`PLAT-03/04`, `DB-03`): every merchant is a row-scoped
tenant on one shared backend, not a dedicated install. That single architectural fact is the whole
story of these economics. The cost of running ShopMaster splits into two very different piles:

- **Shared fixed cost** — the managed container platform, the managed Postgres instance, the region,
  CI/CD, monitoring. This is roughly constant whether there are 50 merchants or 5,000, and it is
  spread across *all* of them. It is not a per-merchant cost.
- **Marginal cost of one more merchant** — the incremental compute, storage, identity, messaging,
  and human support that adding *this* merchant actually causes. **This is the number that decides
  whether a free tier bankrupts you or barely registers.**

The rest of this document builds up that marginal number, line by line, then rolls it into a Starter
tea stall and a Growth restaurant.

**The crucial line ShopMaster does _not_ carry: payment interchange.** Because every payment settles
**directly into the merchant's own rail account** and ShopMaster never holds funds (`PAYINT §1`,
Merchant Agreement §5), the 1–2% a marketplace would eat as interchange is **the merchant's cost to
its own rail, not ShopMaster's cost to serve the merchant.** A commission marketplace's unit
economics are dominated by payment processing; ShopMaster's are not, by construction. That is the
same design choice `WEB-06` is built on, showing up on the cost side of the ledger.

---

## 2. The per-merchant cost lines (marginal, monthly)

### 2.1 Identity / MAU — Auth0 (`Auth-Flow`)

The Tier-1 login is designed to be Auth0-swappable but is **currently a self-contained JWT**
(`packages/core/auth.ts`), so today this line is **$0**. The figure below is what it becomes when
Auth0 is wired.

The cost-control insight: **customers are not authenticated users.** Online ordering is guest
checkout by default (`WEB-05`) and QR ordering needs no login (`QR-02`), so the paying MAU are the
**merchant's staff**, not their diners. A tea stall is **one** staff MAU; a restaurant is a handful.

| | Illustrative |
|---|---|
| Auth0 price per MAU at volume | ~US$0.02–0.05 / staff MAU / month |
| Early-merchant free-tier coverage | first several thousand MAU often $0 on entry plans |
| Starter tea stall (1 staff) | **~$0.00–0.05 / month** |
| Growth restaurant (5–15 staff) | **~$0.10–0.75 / month** |

Assumption to validate: the actual Auth0 plan (B2C vs B2B/organizations pricing differs sharply) and
whether an alternative (self-hosted OIDC) is cheaper at the Nepal free-base scale.

### 2.2 Hosting per tenant (`PLAT-03/04/05`)

Production runs on a managed container platform (Cloud Run / Fly / Railway class) plus managed
Postgres in a Singapore-or-Mumbai region (`DEPLOYMENT.md §4–5`). SQLite is the self-contained dev
store; Postgres is the production target. An order is an append-only log of small text
`OrderEvent` rows (`DB-06`), so a merchant's storage footprint is **tiny** — kilobytes per day, not
media.

Modelled as *shared fixed infra ÷ merchants*, plus a small genuinely-marginal slice (compute for
that merchant's request volume, their storefront traffic, their KDS polling):

| | Illustrative |
|---|---|
| Shared platform + managed Postgres (small production tier) | ~US$150–300 / month total, **shared across all merchants** |
| Marginal hosting — Starter (one phone, low traffic) | **~US$0.20–0.40 / month** |
| Marginal hosting — Growth (several devices, KDS, storefront traffic) | **~US$1.00–2.00 / month** |

The per-merchant hosting number *falls as the base grows*, because the fixed slice divides across
more tenants — the opposite of a marketplace, whose payment cost scales linearly with every merchant's
volume.

### 2.3 Payment-processing fees per rail (illustrative — mostly *not* ShopMaster's cost)

Stated precisely because it is the single most misunderstood line: these are the fees a **merchant**
pays its **own** rail (`PAY-04`, `PAYINT §1`). They are the merchant's economics, shown here for
context and to price the *optional* flat processing fee (`PRD §14`, `WEB-06`) — **they are not
ShopMaster's cost to serve.**

| Rail | Market | Illustrative fee (paid by merchant to the rail) | ShopMaster cost |
|---|---|---|---|
| **Cash** (`PAY-01`) | Both | 0% — first-class, always-available, offline | $0 |
| eSewa / Khalti / Fonepay-style wallet & QR switch | Nepal | ~0.5%–2% or a small capped flat fee | $0 (merchant's own account) |
| Tyro card-present / tap-to-pay (`PAY-02`) | Australia | ~1.4%–1.9% blended card-present | $0 (merchant's own account) |

What *can* land on ShopMaster is the marginal API/gateway call cost when brokering a rail
transaction, which is negligible (fractions of a cent). No raw card data is stored (`PAY-07`), and
**no crypto rail exists for a Nepal merchant — hard rule** (`PAYINT §6.1`); neither adds cost.

### 2.4 SMS / WhatsApp — `CRM-03` (Phase 2/3, usage-based, opt-in)

`CRM-03` chooses SMS and WhatsApp over push because push reach is weak in these markets. It is a
**Phase 2/3** module, opt-in only (`CRM-01`), and **off for a Phase-1 Starter** — so a tea stall's
line here is **$0** until they choose to turn it on. When on, it is pure usage:

| Channel | Illustrative unit cost |
|---|---|
| SMS — Nepal (bulk aggregator) | ~NPR 1–2 / SMS (~US$0.01) |
| SMS — Australia | ~A$0.02–0.05 / SMS |
| WhatsApp — utility (order-ready) | ~US$0.005–0.02 / conversation |
| WhatsApp — marketing category | ~US$0.02–0.08 / conversation |

Illustrative monthly usage: Starter = **0 messages** (feature off). Growth restaurant running
order-ready notifications plus occasional marketing = **~200–800 messages/month → ~US$3–6**.

### 2.5 Support (human, amortised)

Support tracks the tier (community/standard for Starter/Growth, dedicated for Enterprise — Merchant
Agreement §9). The lever `PRD §15` hands us is the **Kailali software entity as a lower-cost Nepali
support and engineering base**, which is what keeps this line small at the free-tier end.

| | Illustrative time | Illustrative cost |
|---|---|---|
| Fully-loaded support labour (Kailali base) | — | ~US$3–6 / hour |
| Starter (mostly one-off onboarding, then near-silent) | ~2–5 min / merchant / month averaged | **~US$0.10–0.50 / month** |
| Growth (config, menu, reporting questions) | ~15–30 min / merchant / month | **~US$1–3 / month** |
| Enterprise (dedicated) | — | priced into the custom quote |

Support cost is the line most sensitive to how good `GAP-07` (onboarding) actually is: a genuinely
self-serve 15-minute activation (`PRD §5`) is what keeps Starter support near this floor instead of
several multiples of it.

---

## 3. Roll-up A — the Starter tea stall (Nepal, free tier)

One owner-operator, one phone, quick mode (`POS-12`), cash-dominant, QR ordering, `CRM-03` off.

| Line | Today (Auth0 stubbed, rails mock) | At production (illustrative) |
|---|---|---|
| Identity / MAU (1 staff) | $0.00 | ~$0.00–0.05 |
| Hosting (marginal) | ~$0.30 | ~$0.20–0.40 |
| Payment processing (ShopMaster's cost) | $0.00 | $0.00 (merchant's own rail) |
| SMS / WhatsApp (`CRM-03` off) | $0.00 | $0.00 |
| Support (amortised) | ~$0.30 | ~$0.10–0.50 |
| **Marginal cost to serve** | **~US$0.60 / month** | **~US$0.30–0.95 / month** |

**A free Starter tea stall costs ShopMaster on the order of US$0.50–1.00 per month** — call it
**under US$1**. That is the subsidy figure the whole free-tier decision rests on.

---

## 4. Roll-up B — the Growth restaurant (Sydney, paid tier)

5–15 staff, several devices, kitchen display, branded online ordering, order-ready notifications on,
occasional marketing.

| Line | Illustrative monthly |
|---|---|
| Identity / MAU (5–15 staff) | ~$0.10–0.75 |
| Hosting (marginal — devices, KDS, storefront traffic) | ~$1.00–2.00 |
| Payment processing (ShopMaster's cost) | $0.00 (merchant's own Tyro account) |
| SMS / WhatsApp (`CRM-03` on) | ~$3–6 |
| Support | ~$1–3 |
| **Marginal cost to serve** | **~US$5–11 / month** |

Against an illustrative Growth subscription (see [PRICING.md](./PRICING.md) — e.g. **A$49/month
≈ US$32**), this is a **gross margin of roughly 80–90%** on the subscription line alone, before any
optional flat processing-fee revenue (`WEB-06`, `PRD §14`). Growth is where the money is; that is the
point.

---

## 5. The free-Starter subsidy math

The `PRD §15` strategy is explicit: **land the smallest merchants free, monetise them as they grow
into Growth and Enterprise** — don't try to charge the tea stall on day one. The arithmetic that has
to hold for that to be sane:

**Cost of the free base.** N free Starters cost ShopMaster **≈ N × US$0.75 / month** (§3 midpoint).
A base of 1,000 free tea stalls is therefore **≈ US$750 / month** — real, but small.

**Who pays for it.** One Growth merchant contributes a monthly margin of roughly:

```
  Growth revenue        ≈ US$32   (A$49 illustrative subscription)
  − Growth cost to serve ≈ US$8    (§4 midpoint)
  = contribution margin  ≈ US$24 / Growth merchant / month
```

**The cross-subsidy ratio:**

```
  US$24 contribution  ÷  US$0.75 per free Starter  ≈  32
```

**So a single paying Growth merchant funds on the order of ~30 free Starter tea stalls** (illustrative;
land anywhere in ~25–45 depending on the price and support figures you plug in). Put the other way: the
free base is self-funding once roughly **1 in ~30 Starters has converted to Growth**, and every
conversion above that line is margin.

**The one sensitivity that actually matters** is therefore **conversion, not cost.** The cost lines in
§2 are small and bounded; the model lives or dies on what fraction of free Starters grow into paying
Growth accounts and how long that takes. Instrument that conversion rate and its time-to-upgrade from
day one — it is the number to manage. (This is the same "monetise as they grow" bet in `PRD §15`, now
with the ratio it depends on made explicit.)

---

## 6. What to validate before relying on any of this

Ranked by how much they move the answer:

1. **Growth-tier conversion rate and time-to-upgrade** — the model's dominant variable (§5). Needs
   real cohort data, which needs `GAP-07` (onboarding) live.
2. **Real Growth price points** — the whole subsidy ratio scales off them (`GAP-03`,
   [PRICING.md](./PRICING.md)); still `[PRICE TBD]` in the Merchant Agreement.
3. **Auth0 plan choice** (§2.1) — B2B/organizations vs B2C pricing differ enough to matter at the
   free-base scale; or whether to swap Auth0 for self-hosted OIDC entirely.
4. **Support minutes per merchant** (§2.5) — the line most sensitive to onboarding quality; if
   self-serve activation is weak, this multiplies.
5. **Real rail fees and any optional flat processing-fee take** (§2.3, `WEB-06`/`PRD §14`) — context
   for the merchant's economics and a potential *second* revenue line, not a cost.
6. **SMS/WhatsApp deliverability and real send volumes** (§2.4) once `CRM-03` ships in Phase 2.

---

*End of draft. This is a planning model, not an accounting statement. Every figure is an illustrative
assumption to validate against real vendor quotes and real usage once `GAP-07` puts merchants on the
platform. It pairs with [PRICING.md](./PRICING.md) (what ShopMaster charges) and
[GTM.md](./GTM.md) (how the free-Starter wedge gets in front of a merchant), and it fills in the
`[PRICE TBD, GAP-03]` placeholders that the [Merchant Agreement](../legal/MERCHANT_AGREEMENT.md) is
waiting on.*
