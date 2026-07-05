**DRAFT — NOT LEGAL ADVICE — REQUIRES REVIEW BY QUALIFIED COUNSEL (Australia + Nepal)**

# ShopMaster — Merchant Agreement

| | |
|---|---|
| **Product** | ShopMaster |
| **Document type** | Legal draft — Merchant Agreement (commercial terms) |
| **Version** | 0.1 — Draft for counsel review |
| **Date** | 5 July 2026 |
| **Status** | **DRAFT.** Placeholder pending the legal-entity decision (GAP-01) and formal review. Closes **GAP-02** (one of three). |

> **This is the commercial contract between ShopMaster and a subscribing Merchant. It is a
> drafting starting point, not a signed agreement.** Who signs it depends on the operating-entity
> decision (GAP-01), and the actual prices are deliberately left as `[PLACEHOLDER]` because unit
> economics are unresolved (`GAP-03`). Do not present this to a Merchant until a qualified lawyer
> admitted in **both** Australia and Nepal has reviewed and completed it. Requirement IDs
> (`WEB-06`, `PAY-07`, `PAYINT §1`, PRD §9) reference the ShopMaster specification in `docs/`.

---

## 1. Parties and structure

This Merchant Agreement (the **"Agreement"**) is between **[LEGAL ENTITY — TBD, see GAP-01]**
(**"ShopMaster"**, **"we"**) and the business that subscribes to the Service (the **"Merchant"**,
**"you"**). It incorporates the **Terms of Service** and the **Privacy Policy** by reference; where
this Agreement conflicts with the Terms of Service for a Merchant, this Agreement prevails. The
Merchant accepts this Agreement by subscribing, by clicking to accept during onboarding, or by
using the Service to take a live order.

## 2. What ShopMaster is — and is not

ShopMaster provides ordering and point-of-sale **software**: one shared order/menu engine surfaced
through the staff POS, self-service kiosk, QR/NFC table ordering, and branded online ordering
channels, plus the admin console and reporting. In providing it, ShopMaster:

- is a **software layer only** — the Merchant is the seller of record for every order and the
  merchant of record for every payment;
- is **not** a bank, payment service provider, payment system operator, remittance provider,
  money-services business, or digital currency exchange, and does not act as one; and
- **never holds, pools, or redistributes** Customer or Merchant funds (§5, `PAYINT §1`).

## 3. Subscription tiers (PRD §9)

The Service is offered in tiers. The tiering exists to protect progressive complexity (the same
app is a three-button tea-stall POS or a full restaurant back office), not merely to segment price;
a feature enabled for a tier is what that Merchant's capability manifest allows (`FE-06`).

| Tier | Who it's for | Included (illustrative) | Price shape |
|---|---|---|---|
| **Starter** | Tea stall, single food truck | POS in quick mode, QR ordering, cash + tap-to-pay-on-phone where supported, one device | **Free or near-free flat fee, no monthly minimum** — `[CONFIRM per GAP-03]` |
| **Growth** | Café, bar, single restaurant | Everything in Starter, plus kiosk mode, NFC, branded online ordering, inventory, multiple devices, kitchen display | Flat monthly fee, optional payment-processing fee — `[PRICE TBD, GAP-03]` |
| **Enterprise** | Multi-location chains, franchises | Everything in Growth, plus multi-location console, franchise tooling, API access, dedicated support, an SLA | Custom, priced per location — `[TBD]` |

The specific inclusions, limits, and prices for the Merchant are those shown in the Merchant's
order/onboarding record at sign-up, which forms part of this Agreement. Actual prices are pending
unit-economics work (`GAP-03`) and must be set before this Agreement is used.

## 4. Fees, billing, and the no-commission promise (WEB-06)

- **No per-order commission — ever.** ShopMaster charges a **subscription and/or a flat
  payment-processing fee, never a per-order percentage** on the value of a Merchant's sales
  (`WEB-06`). This is a core, stated product commitment — the deliberate point of difference
  against marketplace aggregators that charge 20–30% and keep the customer relationship — not a
  discretionary pricing choice we reserve the right to quietly reverse. Any future move away from
  it would require the notice and consent process in §12 and, given how central it is to the
  product, is treated as a material change.
- **What we may charge:** the tier subscription fee (if any), an **optional flat or low
  payment-processing fee** for Merchants who use ShopMaster-integrated rails (priced well below
  marketplace commission levels), and optional add-ons (e.g. hardware bundles, custom domain,
  Enterprise support). Hardware is always an optional add-on or rental, never mandatory and never
  bundled into the base subscription (PRD §14).
- **Fee transparency.** A Merchant can see what each payment rail cost it, per the merchant-facing
  reporting commitment (`RPT-01`, Payment Integration §9) — not just a net total.
- **Billing.** Fees are billed **[MONTHLY/ANNUALLY — TBD]** in the Merchant's currency (AUD or
  NPR), exclusive of taxes unless stated; the Merchant is responsible for its own tax on its own
  sales. Late or failed payment may lead to suspension under §11.

## 5. Payments — the Merchant owns its own payment account; ShopMaster never holds funds (PAYINT §1)

This is the one decision that shapes everything about payments, and it is a term of this Agreement:

- Every payment taken through the Service settles **directly into the Merchant's own account** —
  the Merchant's own Fonepay/bank registration, its own eSewa or Khalti wallet, its own Tyro
  Transaction Account. ShopMaster's software calls the **Merchant's own credentials** to initiate
  and confirm a transaction and **never pools funds centrally or redistributes them** (`PAYINT §1`).
- The Merchant is responsible for holding, and keeping in good standing, its own valid
  payment-account relationships and for that provider's terms, fees, and settlement timing (e.g.
  same-day Tyro vs T+1 NepalQR). Payment disputes and chargebacks are between the Merchant, its
  Customer, and the relevant rail.
- **No cryptocurrency for a Nepal-based Merchant — hard rule.** No Web3 / cryptocurrency (including
  stablecoin) payment method is available to, or may be routed through, a Nepal-based Merchant
  account, because accepting cryptocurrency payment is illegal in Nepal (`PAYINT §6.1`). The
  Service does not expose any crypto rail to an NPR-denominated account. Any Web3 acceptance, in
  the markets where it is lawful, would be provided only through an already-licensed third-party
  processor so that ShopMaster itself never exchanges crypto for fiat (`PAYINT §6.3`) — and is out
  of scope of this Agreement until separately offered.

## 6. PCI-DSS and card-data posture (PAY-07)

- **No raw card data ever touches ShopMaster's servers or devices.** Card payments are tokenised
  through **PCI-DSS-compliant processors**, and ShopMaster only ever stores the returned token,
  never a card number (`PAY-07`, `BE-09`). This keeps ShopMaster's own PCI-DSS scope minimal by
  design.
- The Merchant must not attempt to capture, store, or transmit raw card data through the Service
  (for example in a free-text field), and must use only the Service's tokenised payment flows.
- ShopMaster maintains reasonable, PCI-DSS-aligned security around the payment flow and its
  secrets (`PLAT-14`); the strength of that promise depends on the whole secret-handling practice,
  not one control (`PLAT-14`).

## 7. Merchant obligations

The Merchant will: keep its account and Content accurate (menu, prices, allergen/dietary info);
charge and remit its own taxes (the Service computes jurisdiction-aware tax — AU GST-exclusive, NP
VAT-inclusive — but the Merchant is the taxpayer, `POS-10`/`LOC-02`); comply with its jurisdiction's
licensing, food-safety, consumer, tax, and invoicing rules (including Nepal IRD/CBMS fields where
in scope, `LOC-03/04`); keep credentials and PINs secure and revoke departed staff (`STAFF-01`,
`DEVICE-02`); use the Service only within the Acceptable Use rules (Terms of Service §5); and act
as the controller of its Customers' personal information, with its own privacy notice, honouring
opt-in for marketing (`CRM-01`) and supporting deletion requests through the soft-delete/hard-delete
flow (`DB-14`).

## 8. Data ownership, export, and privacy roles

- **The Merchant owns its own Content and Order Records.** ShopMaster holds a licence to host and
  process them only to provide the Service and as the Privacy Policy describes.
- For Customer personal information, the **Merchant is the controller and ShopMaster is the
  processor**, acting on the Merchant's documented instructions (Privacy Policy §1). Each party
  will support the other in meeting privacy obligations, including breach response under the
  Notifiable Data Breaches scheme (Privacy Policy §8, `GAP-10`).
- **Data export on exit.** On termination, the Merchant may, for a reasonable window, export its
  order, menu, and reporting data in a machine-readable format before ShopMaster deletes or
  de-identifies it per the retention rules (`DB-14`/`DB-15`). **[EXPORT WINDOW — TBD.]**

## 9. Availability and support

- We aim to keep the Service available and to operate it offline-first so cash orders survive a
  loss of connectivity (`SYNC-01..05`), but outside an Enterprise SLA we do not commit to a
  specific uptime figure. Any SLA credits are those in the Enterprise order form.
- Support level tracks the tier (community/standard for Starter/Growth; dedicated for Enterprise).

## 10. Intellectual property and brand

ShopMaster owns the Service and its software and trade marks; the Merchant gets a limited,
revocable, non-exclusive right to use it during the subscription. The Merchant retains its own
brand and Content and grants ShopMaster a licence to display them on the Merchant's branded
storefront (`WEB-01`). The "ShopMaster" name is not yet trade-mark-cleared in either market
(`GAP-11`) and this clause is subject to that check.

## 11. Suspension

We may suspend the Service (in whole or part) on reasonable notice, or immediately where the
circumstances require, for: non-payment; a breach of Acceptable Use (Terms of Service §5) or of §5
of this Agreement (including any attempt to route crypto through a Nepal account); a security or
legal risk; or a legal requirement. We will restore access once the cause is resolved, where we
lawfully can.

## 12. Term, termination, and material changes

- **Term.** This Agreement runs for the subscription term shown at sign-up and renews per that
  record unless cancelled.
- **Termination by the Merchant.** The Merchant may cancel at the end of the current billing
  period (or immediately for a free Starter account), through the admin console or by notice.
- **Termination by ShopMaster.** We may terminate for the Merchant's material, uncured breach (with
  a cure period of **[e.g. 14 days — TBD]** where the breach is curable), for insolvency, or where
  continuing would be unlawful. We may also terminate on **[NOTICE PERIOD — TBD]** for
  convenience, refunding any prepaid, unused fees.
- **Material changes.** We may change the Service or these terms; a material change (including any
  change to the no-commission commitment in §4) requires reasonable prior notice, and the
  Merchant's right, if it does not accept, is to terminate before the change takes effect without
  penalty.
- **On termination:** access ends; the Merchant's data-export window (§8) opens; retention and
  deletion run per the Privacy Policy (`DB-14`/`DB-15`); and the surviving clauses (definitions,
  IP, confidentiality, liability, indemnity, governing law) continue. Because ShopMaster never
  holds Merchant funds (§5), there is no held balance to release on exit — funds have already
  settled to the Merchant's own account.

## 13. Warranties, liability, and consumer law

- Each party warrants it has the authority to enter this Agreement. Beyond that, and subject to the
  next point, the Service is provided on the "as is" basis and with the disclaimers in the Terms of
  Service §10.
- **Nothing in this Agreement excludes any right or guarantee that cannot lawfully be excluded**,
  including under the **Australian Consumer Law** or the equivalent Nepali law (Terms of Service
  §11). Subject to that, liability is limited as set out in the Terms of Service §12, and neither
  party is liable for the other's indirect or consequential loss.
- ShopMaster is not liable for a Payment Rail's acts or omissions, for a Merchant's own legal or
  tax non-compliance, or for loss arising from a Merchant's failure to keep credentials secure.

## 14. Confidentiality and indemnity

- Each party will keep the other's non-public information confidential and use it only for this
  Agreement.
- The Merchant indemnifies ShopMaster against third-party claims arising from the Merchant's
  Content, its sales to its Customers, its breach of this Agreement or of law, or its misuse of the
  Service — subject to the non-excludable-rights carve-out in §13.

## 15. Governing law

**[GOVERNING LAW / JURISDICTION — TBD, see GAP-01.]** The intended structure is the law of the
relevant state of **Australia** for an Australian Merchant and the law of **Nepal** for a
Nepal-based Merchant, with seat and jurisdiction fixed on review once the operating entity is
chosen. Nothing displaces the mandatory consumer or data-protection law of the Merchant's market.

## 16. General

Assignment (Merchant needs consent; ShopMaster may assign to an affiliate/successor), no waiver,
severability, notices through the admin console or to the account email, and entire-agreement
(this Agreement + Terms of Service + Privacy Policy + the sign-up order record) — each applies as
in the Terms of Service §16.

## 17. Signature / acceptance

**[EXECUTION BLOCK / CLICK-ACCEPT MECHANISM — TBD.]** ShopMaster: **[LEGAL ENTITY — TBD, see
GAP-01]**. Merchant: as identified in the sign-up record.

---

*End of draft. This document is intentionally incomplete: the operating entity, prices (`GAP-03`),
notice/cure periods, export window, and execution mechanism must be settled by qualified counsel
admitted in Australia and Nepal before use.*
