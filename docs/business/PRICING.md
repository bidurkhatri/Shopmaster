# ShopMaster — Pricing (illustrative tier prices)

| | |
|---|---|
| **Product** | ShopMaster |
| **Document type** | Business model — pricing & packaging |
| **Version** | 0.1 — Draft for review |
| **Date** | 5 July 2026 |
| **Prepared by** | Bidur |
| **Status** | **DRAFT.** Turns the `PRD §9` tier table into **concrete illustrative prices**. Every price is an assumption to validate, pending `GAP-03`. |

This document takes the deliberately price-free tier table in `PRD §9` and puts **concrete
illustrative numbers** against it, so the [Merchant Agreement](../legal/MERCHANT_AGREEMENT.md)'s
`[PRICE TBD, GAP-03]` placeholders have something to point at, and so the no-commission positioning
(`WEB-06`) can be stated as a real merchant-facing claim rather than an intention. The costs these
prices have to clear are in [UNIT_ECONOMICS.md](./UNIT_ECONOMICS.md).

> **Every price below is illustrative and unvalidated.** They are round, defensible starting points
> for pricing research, not decisions — the real numbers depend on the unit-economics work (`GAP-03`),
> the operating entity (`GAP-01`, which sets tax and currency of billing), and competitive pricing in
> each market. Do not put any of these in front of a merchant until reviewed. **Illustrative FX:**
> US$1 ≈ NPR 133 ≈ A$1.5.
>
> **Money convention.** All amounts are stored in-system as **integer minor units** (paisa / cents)
> per the platform-wide rule (`POS-10`, tax engine in `packages/core/pricing-tax.ts`); the figures
> here are the human-readable display values.

---

## 1. The pricing principle (`WEB-06`, `PRD §14`)

Two rules govern every number in this document, and they are product decisions, not marketing lines:

1. **No per-order commission — ever.** ShopMaster charges a **subscription and/or a flat
   payment-processing fee, never a percentage of the merchant's sales** (`WEB-06`). This is the
   deliberate point of difference against marketplace aggregators (Zomato, UberEats, Foodpanda,
   Menulog) that charge **20–30% and keep the customer relationship** (`PRD §2`, §13). It is stated
   here, and required to be stated in merchant-facing marketing (`WEB-06`), not buried.
2. **Price protects progressive complexity, not just revenue** (`PRD §9`). The tiers exist so a tea
   stall sees three buttons (`POS-12`) and a restaurant sees the back office — the same app in a
   different capability manifest (`FE-06`), not two products. If a feature can't be cleanly hidden
   from Starter, that's a config bug, not a reason to price around it.

Revenue comes from three places (`PRD §14`): **tier subscriptions** (primary), an **optional low flat
payment-processing fee** on ShopMaster-integrated rails (§4), and **optional hardware bundles**
(§5) — never a sales commission.

---

## 2. The tiers, with concrete illustrative prices

Prices shown per market because willingness-to-pay and currency differ. **Illustrative only.**

| Tier | Who (`PRD §4/§9`) | Included | Nepal (NPR) | Australia (AUD) |
|---|---|---|---|---|
| **Starter** | Tea stall, single food truck | POS quick mode (`POS-12`), QR ordering (`QR-01..06`), cash + tap-to-pay-on-phone where supported (`PAY-01/02`), one device | **Free forever — NPR 0**, no monthly minimum | **Free forever — A$0**, no monthly minimum |
| **Growth** | Café, bar, single restaurant | Everything in Starter, **plus** kiosk mode (`KIOSK`), NFC (`NFC`), branded online ordering (`WEB-01..06`), inventory (`INV`), multiple devices, kitchen display | **~NPR 2,500 / month** (≈ US$19) | **~A$49 / month** (≈ US$32) |
| **Enterprise** | Multi-location chains, franchises | Everything in Growth, **plus** multi-location console (`MULTI`), franchise tooling, API access, dedicated support, an SLA | **Custom, per location** | **Custom, per location** (illustratively from ~A$99 / location / month + setup) |

Notes on the illustrative figures:

- **Starter is genuinely free, not a trial.** No card required, no monthly minimum (`PRD §9`). The
  [unit-economics model](./UNIT_ECONOMICS.md) shows this costs ShopMaster **under ~US$1/merchant/month**
  to serve, which is what makes "free forever" affordable rather than reckless.
- **Growth** is a single flat monthly fee. The Nepal and Australia numbers are set independently
  (not an FX conversion of one another) because they price against different local competitors and
  different willingness-to-pay — a deliberate choice, to revisit with real market data.
- **Enterprise** is quoted per location with a setup component; the number is a placeholder to anchor
  a conversation, not a rate card.
- An annual-billing discount (e.g. ~2 months free on annual prepay) is a lever to consider once the
  monthly numbers are validated — left out here to keep the table honest.

---

## 3. The no-commission math — why this is the whole pitch (`WEB-06`)

The point of a flat fee only lands if you show it against a commission. Two illustrative worked
examples; the GMV figures are examples, the commission rates are the real 20–30% marketplace range.

**A Sydney restaurant doing 1,000 online orders/month at an A$25 average = A$25,000 online GMV:**

| Route | What the merchant pays for online ordering | Keeps the customer relationship? |
|---|---|---|
| Marketplace @ 25% commission | **A$6,250 / month** | No — the marketplace owns it |
| **ShopMaster Growth (flat)** | **A$49 / month** (+ the merchant's own card fees, which they'd pay on any route) | **Yes — their own domain, their own data** (`WEB-01/05`) |
| **Difference** | **≈ A$6,200 / month kept by the merchant** | — |

**A Nepal café doing 300 online/QR orders/month at an NPR 400 average = NPR 120,000 GMV:**

| Route | What the merchant pays | |
|---|---|---|
| Aggregator @ 20% commission | **NPR 24,000 / month** | |
| **ShopMaster** — Starter free, or Growth ~NPR 2,500/month | **NPR 0–2,500 / month** | |
| **Difference** | **≈ NPR 21,500–24,000 / month kept** | |

This is the commission-independence metric `PRD §5` says to track against competitors — "the number
to track, not a rounding error." A flat fee wins by a wider margin the more the merchant sells,
because ShopMaster's price **does not scale with their GMV** and a commission does. That is `WEB-06`
expressed as arithmetic.

---

## 4. The optional flat payment-processing fee (`PRD §14`, `WEB-06`)

Distinct from commission, and optional. Where a merchant uses a **ShopMaster-integrated rail**
(`PAY-04`), ShopMaster *may* add a **low flat per-transaction fee or a low flat percentage priced
well below marketplace levels** (`PRD §14`) — for example an illustrative **flat NPR 2 / A$0.10 per
transaction**, or a low sub-1% figure. Firm rules:

- **Never on cash** (`PAY-01`) — cash is always free to take.
- **Never charged** where a merchant simply uses **their own rail account directly** — in that case
  the merchant pays only their own rail, and ShopMaster takes nothing on the transaction
  (`PAYINT §1`, Merchant Agreement §5).
- **Never a percentage of order value in the commission sense** — it is a processing fee tied to the
  transaction, not a cut of the sale, and it stays "well below marketplace commission levels"
  (`PRD §14`) or it defeats the entire positioning.
- **Fully transparent** — a merchant can see what each rail cost, per rail, in reporting
  (`RPT-01`, Merchant Agreement §4), not just a net total.

Whether to charge this at all, and at what level, is a `GAP-03` decision — it is a potential *second*
revenue line, not a load-bearing one; the subscription tiers are the primary line (`PRD §14`).

---

## 5. Add-ons (never mandatory)

| Add-on | Shape | Ref |
|---|---|---|
| **Custom domain** (`order.merchantname.com`) | Higher-tier add-on vs the free `merchant.shopmaster.app` subdomain | `WEB-01` |
| **Hardware bundles** (thermal printer, cash drawer, kiosk stand, external reader) | Optional **sale or rental**, never bundled into the base price, never a prerequisite | `PRD §14`, `HW-05/06` |
| **Enterprise support & SLA** | Part of the custom Enterprise quote | `PRD §9`, Merchant Agreement §9 |

The minimum viable hardware to run ShopMaster is **one smartphone** (`HW-06`); every item above is an
upgrade layered on the same core app, so no add-on ever gates the base experience.

---

## 6. What Starter includes free, forever (the wedge)

Stated plainly because it is the acquisition engine (see [GTM.md](./GTM.md)): a Starter merchant gets,
at **zero cost and no monthly minimum**, a real running business tool — quick-mode POS (`POS-12`),
QR table/counter ordering (`QR`), cash and tap-to-pay-on-phone where supported (`PAY-01/02`),
menu management (`MENU`), offline-first operation (`SYNC-01..05`), and basic daily reporting
(`RPT-01`). Not a crippled demo — the actual product, in its tea-stall configuration. The upgrade to
Growth buys *more surface* (online storefront, kiosk, NFC, multi-device, KDS, inventory), never the
un-crippling of Starter.

---

## 7. Merchant-facing positioning line (required by `WEB-06`)

For the marketing surface, one sentence to hold the whole thing together:

> **Your own ordering, on your own name — a flat monthly fee, never a 20–30% commission. Start free
> on one phone, keep every rupee and dollar your marketplace used to take.**

---

*End of draft. Every price here is an illustrative assumption to validate (`GAP-03`) and to sign off
with the operating entity once chosen (`GAP-01`). It pairs with
[UNIT_ECONOMICS.md](./UNIT_ECONOMICS.md) (the costs these prices clear) and
[GTM.md](./GTM.md) (how the free-Starter wedge reaches a merchant), and it supplies the numbers the
[Merchant Agreement](../legal/MERCHANT_AGREEMENT.md) leaves as `[PRICE TBD, GAP-03]`.*
