# ShopMaster — Go-to-Market (self-serve acquisition)

| | |
|---|---|
| **Product** | ShopMaster |
| **Document type** | Business model — go-to-market motion |
| **Version** | 0.1 — Draft for review |
| **Date** | 5 July 2026 |
| **Prepared by** | Bidur |
| **Status** | **DRAFT.** Closes **GAP-12**. The motions and figures here are illustrative assumptions to validate. |

Closes **GAP-12**. Go-to-market notes exist at a strategic level in `PRD §15`, but there was never an
actual plan for **how a merchant who isn't already talking to Bidur directly finds ShopMaster and
signs up.** This document is that plan: a **self-serve acquisition motion** built on the
**free-forever Starter tier as the wedge** (`PRD §15`), with the Nepal and Australia motions the PRD
calls for spelled out.

> **This is a plan to validate, not a validated plan.** The channels, funnel, and any numbers below
> are illustrative and unproven — the honest posture of the rest of this repo. The motion also has
> hard dependencies that are not all closed yet (§8): most of all `GAP-07` (the merchant onboarding
> flow), because a self-serve motion is only as good as the 15-minute activation it promises
> (`PRD §5`). Nothing here should be read as "this is working" — it is "this is the bet."

---

## 1. The core motion: self-serve, wedge-led

The whole motion is one sentence: **a merchant finds ShopMaster, signs up for free with no card and
no hardware, and is taking a live QR order in under 15 minutes** (`PRD §5` headline metric) — **with
no sales call in the loop.** That is what "self-serve" means here, and it is only possible because two
things are true at once:

- **The price objection is removed entirely.** Starter is free forever, no monthly minimum
  ([PRICING.md](./PRICING.md), `PRD §9/§15`) — there is nothing to approve, expense, or negotiate.
- **The hardware objection is removed entirely.** The floor is one smartphone (`HW-06`), installable
  as a PWA from a browser (`HW-01`) — no app-store friction, no terminal to buy.

Everything a founder-led sale would normally do — de-risk the price, hand-hold the setup — has to be
done by the **product** instead: the guided setup wizard tuned by business type (`ADMIN-02`) and the
onboarding flow (`GAP-07`). The motion succeeds or fails on that activation moment, not on a pitch.

---

## 2. Why free Starter is the wedge (and can afford to be)

`PRD §15` is explicit: treat **"free forever" Starter as the primary acquisition channel for the
smallest merchants, and monetise as they grow into Growth and Enterprise** rather than charging the
tea stall on day one. Two reasons this is a real strategy and not just discounting:

1. **It is cheap to give away.** [UNIT_ECONOMICS.md](./UNIT_ECONOMICS.md) puts the marginal cost of a
   free Starter at **under ~US$1/merchant/month**, and shows **one paying Growth merchant funds on the
   order of ~30 free Starters.** The free base is self-funding once roughly 1 in ~30 Starters
   converts. So the wedge is a **customer-acquisition cost that is mostly infrastructure, not spend** —
   you are not buying users, you are hosting them cheaply until some grow.
2. **The product is its own distribution.** Every Starter merchant deploys a **branded QR at their
   counter/tables** (`QR-01`) and a **branded storefront** (`WEB-01`) that their own customers see —
   and some of those customers run food businesses themselves. A "powered by ShopMaster" surface on
   thousands of tea-stall counters is a **product-led growth loop**, not a paid channel. The QR a
   diner scans is a demo of the product to a future merchant.

The upgrade path is the business model: Starter lands them, Growth (kiosk, online storefront, NFC,
multi-device, KDS, inventory) is what they grow into as their operation gets more complex, and that
Growth revenue subsidises the next cohort of free tea stalls.

---

## 3. The self-serve funnel and the metrics that gate it

| Stage | What happens | The gating metric (`PRD §5`) |
|---|---|---|
| **Awareness** | Merchant hears about ShopMaster (product loop §2, or the market motions §4–5) | reach in target clusters |
| **Signup** | Free Starter, no card, business-type wizard (`ADMIN-02`) | signup → started-setup rate |
| **Activation** | **First live QR order taken, < 15 minutes, zero hardware** (`PRD §5`, `GAP-07`) | **time-to-first-sale — the make-or-break gate** |
| **Habit** | Daily use — running totals, cash, QR, offline (`SYNC`) becomes the till | weekly-active merchants |
| **Expand** | Turns on branded online ordering within 30 days (`WEB-01`); later upgrades to Growth | **branded-ordering adoption; Starter→Growth conversion** |

Activation is the single most important gate — it is where a self-serve motion with no salesperson
either delivers on the 15-minute promise or loses the merchant silently. Instrument it first. The
expansion metrics (30-day branded-ordering adoption, Starter→Growth conversion) are the ones the
[unit-economics model](./UNIT_ECONOMICS.md) is most sensitive to — track them from day one.

---

## 4. Nepal motion (`PRD §15`)

Nepal covers the full tea-stall-through-restaurant range this product is written around, and comes
with structural advantages the PRD names directly.

**Assets to lean on (`PRD §15`):**

- **The Kailali (Attariya-area) software entity** as a local **development, support, and
  feet-on-street** base — the same lower-cost base that keeps the support line small in
  [UNIT_ECONOMICS.md §2.5](./UNIT_ECONOMICS.md). This gives Nepal a *ground game* an ordinary
  self-serve motion can't, at a cost the free tier can carry.
- **Existing Kathmandu engineering relationships** for credibility and early referrals.
- **Local-by-design product** — Nepali UI from day one (`LOC-01`), NPR pricing, and familiar payment
  rails (eSewa / Khalti / Fonepay-style, `PAY-04`). Rail familiarity is trust; a merchant who already
  uses eSewa personally believes the product is for them.

**Channels:**

- **Ground presence in market clusters** — tea-stall streets and food-market rows, where merchants are
  physically dense and word-of-mouth travels fast. Free Starter means the entire pitch is "scan this,
  you're live, it costs nothing."
- **Nepali-language social and messaging** — Facebook and WhatsApp are where these merchants already
  are; note that WhatsApp is also the `CRM-03` channel, so the same rail serves acquisition *and*
  retention.
- **Local business/market associations** for cluster referrals.
- **The product loop (§2)** — every branded QR on a counter is local advertising.

**Guardrails:** **no crypto path for a Nepal merchant — hard rule** (`PAYINT §6.1`); it is never a
GTM lever, only a wall. And keep the Nepal e-billing obligation (`LOC-03/04`) in view *before*
courting any large restaurant/hotel account near the hospitality turnover threshold — a
Phase 2/3 gate, not an MVP blocker, but not a surprise to discover mid-sales-cycle either.

---

## 5. Australia motion (`PRD §15`)

Australia covers the café/bar/restaurant market from the Sydney base, and is where the paying
Growth/Enterprise revenue that subsidises the Nepal free base actually comes from.

**Beachhead:** the **Nepali-Australian diaspora food scene** — restaurants and cafés run by owners who
bridge both markets, are reachable through the same community networks as the Nepal motion, and are a
warm, credible first cohort in Sydney.

**Channels:**

- **Digital self-serve built on the `WEB-06` wedge** — SEO and comparison content around
  *commission-free online ordering*, landing pages that put a flat monthly fee next to
  Menulog/UberEats' 20–30% commission (the worked example in [PRICING.md §3](./PRICING.md)). This is
  the sharpest message ShopMaster has and Australia is the market most primed to hear it, because the
  commission pain is acute and quantified.
- **Tap-to-pay-on-own-phone (`PAY-02`, Tyro-class) as a hook** — accept contactless with no card
  reader purchased; a concrete "start on the phone in your pocket" story.
- **Higher willingness to pay** → Growth/Enterprise is the primary revenue motion here, per
  [PRICING.md §2](./PRICING.md), even as Starter stays free.

Australia is more digital-self-serve and less ground-game than Nepal — the funnel (§3) is the same,
but the awareness stage leans on search/content and the diaspora network rather than physical market
clusters.

---

## 6. Channels at a glance

| Channel | Market | Motion | Cost shape |
|---|---|---|---|
| Product loop (branded QR/storefront, `QR-01`/`WEB-01`) | Both | Product-led, self-serve | ~Free — it's the product |
| Market-cluster ground game (Kailali base) | Nepal | Assisted self-serve | Low — Kailali support-base labour |
| Nepali social / WhatsApp / Facebook | Nepal | Self-serve | Low — organic + light spend |
| `WEB-06` comparison SEO/content | Australia | Self-serve | Content production |
| Diaspora community network | Both | Warm self-serve | ~Free — existing relationships |
| Tap-to-pay hook (`PAY-02`) | Australia | Self-serve | Product feature |

---

## 7. Positioning & messaging

- **The one line (`WEB-06`, required to be stated in marketing):** *your own ordering on your own
  name — a flat fee, never a 20–30% commission* ([PRICING.md §7](./PRICING.md)).
- **The activation promise (`PRD §5`):** *one phone, zero hardware, first order in 15 minutes, free.*
- **The local-by-design proof (`LOC-01`, `PAY-04`):** Nepali from day one, your own eSewa/Khalti,
  NPR pricing — not a Western product with a translation bolted on.

The commission-independence message (`WEB-06`) is the single sharpest differentiator and should lead
every surface — it is a quantified, provable claim (`PRD §5` calls it "the number to track"), not a
feature comparison.

---

## 8. What has to be true for this motion to work (honest dependencies)

A self-serve, wedge-led motion has no salesperson to paper over gaps, so it is unusually dependent on
things that are not all closed:

- **`GAP-07` — the merchant onboarding flow.** The make-or-break dependency: the 15-minute activation
  (§1, §3) *is* this flow. `NEXT_STEPS` names it the highest-leverage single next deliverable, and
  this motion is the reason why.
- **`ADMIN-02` — the business-type setup wizard.** The self-serve product's stand-in for a
  hand-holding sales engineer.
- **`GAP-02` — ToS / Privacy / Merchant Agreement.** You cannot legally onboard a merchant self-serve
  without a click-accept agreement in place — now drafted in [`docs/legal/`](../legal/), pending
  counsel and the `GAP-01` entity decision.
- **`GAP-03` — prices set.** The wedge is free, but the *upgrade* path (Growth/Enterprise) needs real
  numbers ([PRICING.md](./PRICING.md)) before conversion can be sold.
- **`GAP-11` — the "ShopMaster" trademark check** in both markets before a brand-led acquisition push
  puts the name on thousands of storefronts.
- **`GAP-01` — the operating entity.** Decides who the merchant actually contracts with, which shapes
  the Nepal-vs-Australia legal and support structure this motion assumes.

Until `GAP-07` in particular is real and good, this document describes the intended motion, not a
running one.

---

*End of draft. The motions, channels, and figures here are illustrative assumptions to validate. This
document pairs with [PRICING.md](./PRICING.md) (the wedge and the upgrade path it feeds) and
[UNIT_ECONOMICS.md](./UNIT_ECONOMICS.md) (why the free-Starter wedge is affordable), and it closes
`GAP-12` in [`NEXT_STEPS.md`](../../NEXT_STEPS.md).*
