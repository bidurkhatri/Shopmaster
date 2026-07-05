**DRAFT — NOT LEGAL ADVICE — REQUIRES REVIEW BY QUALIFIED COUNSEL (Australia + Nepal)**

# ShopMaster — Terms of Service

| | |
|---|---|
| **Product** | ShopMaster |
| **Document type** | Legal draft — Terms of Service (end-user / merchant-facing) |
| **Version** | 0.1 — Draft for counsel review |
| **Date** | 5 July 2026 |
| **Status** | **DRAFT.** Placeholder pending the legal-entity decision (GAP-01) and formal review. Closes **GAP-02** (one of three). |

> **This is a drafting starting point, not a signed legal instrument.** Every bracketed
> `[PLACEHOLDER]` is a decision the operating entity and its counsel must make. The
> operating entity, governing-law seat, and the split of obligations between the Australian
> and Nepali frameworks all depend on GAP-01, which is unresolved. Do not publish, link, or
> present this to a merchant or customer until a qualified lawyer admitted in **both**
> Australia and Nepal has reviewed and completed it. Requirement IDs (`WEB-06`, `PAY-07`,
> `CRM-01`, `PAYINT §1`, etc.) reference the ShopMaster specification in `docs/` so each
> clause traces to the product behaviour it describes.

---

## 1. Who these Terms are between

These Terms of Service (the **"Terms"**) are a legal agreement between you and
**[LEGAL ENTITY — TBD, see GAP-01]** (**"ShopMaster"**, **"we"**, **"us"**), the provider of
the ShopMaster ordering platform (the **"Service"**).

The Service is used by three kinds of person, and these Terms apply to all of them:

- a **Merchant** — a business that subscribes to ShopMaster to run its ordering, point of
  sale, and payments (a tea stall in Nepal, a café or restaurant in Australia, and everything
  between — see the ShopMaster PRD §4 personas);
- **Merchant Staff** — an owner, manager, or staff member who signs in to operate the Service
  on a Merchant's behalf; and
- a **Customer** — a member of the public who places an order through a Merchant's QR/NFC
  table ordering, self-service kiosk, or branded online ordering page (`WEB-01`).

A Merchant's commercial relationship with ShopMaster (subscription tiers, fees, the
commission-free promise, payment-account ownership, termination) is governed by the separate
**Merchant Agreement** (`docs/legal/MERCHANT_AGREEMENT.md`). Where these Terms and the Merchant
Agreement conflict for a Merchant, the Merchant Agreement prevails.

By creating an account, signing in with a staff PIN, or placing an order through a ShopMaster
surface, you agree to these Terms. If you do not agree, do not use the Service.

## 2. Definitions

- **"Service"** — the ShopMaster software platform: one shared order/menu engine surfaced
  through four channels (staff POS, self-service kiosk, QR/NFC table ordering, and branded
  online ordering), together with the admin console, reporting, and supporting APIs.
- **"Order Record"** — the append-only, event-sourced log of order events (`ORDER_CREATED`,
  `ITEM_ADDED`, `PAYMENT_CAPTURED`, and the like) and the materialised order it replays to
  (Backend/Database Architecture, `DB-06..DB-10`).
- **"Payment Rail"** — a third-party payment method the Service can initiate on a Merchant's
  behalf (e.g. Cash, Fonepay/NepalQR, eSewa, Khalti, Tyro), settling to that Merchant's own
  account (`PAYINT §1`). ShopMaster is not itself a Payment Rail.
- **"Content"** — menu items, prices, branding, images, and any other material a Merchant
  configures in or uploads to the Service.

## 3. The Service

ShopMaster provides ordering and point-of-sale software. In plain terms:

- One shared engine records orders once and serves them to every channel — a Merchant's POS,
  kiosk, QR/NFC tables, and online page all write to the same menu and the same Order Record;
  they are never separate systems kept in sync by hand.
- The Service is **offline-first**. The POS writes every action to a local outbox first and a
  background worker syncs it to our servers when connectivity returns (`SYNC-01..05`). Cash
  orders work with no connection; card and digital rails cannot authorise offline and fall back
  to cash (`FE-12`).
- The features available to any given account depend on the Merchant's subscription tier and
  business type, resolved at sign-in into a capability manifest (`FE-06`). Not every feature
  described in our documentation is enabled for every account.

We may add, change, or remove features. Where a change materially reduces the Service a
Merchant pays for, §14 (Changes) and the Merchant Agreement govern notice.

## 4. Accounts, devices, and staff access

- **Tier-1 sign-in.** An owner or manager authenticates with an email and password to pair a
  device to the Merchant's organisation (Auth-Flow, Tier 1).
- **Tier-2 staff PIN.** Individual staff switch on a paired device using a short numeric PIN.
  PINs are stored only as a salted hash and are never recoverable in plain text; we can only
  reset them (`STAFF-01`, and see the Privacy Policy §3).
- You are responsible for keeping credentials confidential, for every action taken under your
  account or PIN, and for revoking access for staff who leave. Devices are independently
  revocable (`DEVICE-02`).
- You must give accurate account information and keep it current. You must be old enough to form
  a binding contract in your jurisdiction to hold a Merchant or Staff account.

## 5. Acceptable use

You must not, and must not permit anyone to:

1. use the Service for any unlawful purpose, or to sell goods or services whose sale is illegal
   in the Merchant's operating jurisdiction;
2. **accept, request, or record cryptocurrency (including stablecoins) as payment through a
   Nepal-based Merchant account** — this is prohibited without exception because cryptocurrency
   payment is illegal in Nepal (`PAYINT §6.1`); the Service does not expose any crypto rail to
   an NPR-denominated account, and you must not attempt to route one through it;
3. misrepresent tax treatment, prices, or the identity of the selling merchant to customers, or
   use the Service to issue invoices that do not reflect the real transaction;
4. attempt to access another Merchant's tenant, order data, or customer data, or to defeat the
   Service's tenant-isolation boundaries (`BE-10/11`);
5. probe, scan, penetration-test, overload, or rate-limit-evade the Service or its public
   endpoints (`BE-13`) except under a written testing authorisation from us;
6. reverse engineer, decompile, scrape, or resell the Service, or use it to build a competing
   product, except to the extent that restriction is prohibited by law;
7. upload Content you do not have the right to use, or that is unlawful, infringing, deceptive,
   or malicious (including malware);
8. use the Service to send marketing to a Customer who has not opted in, or otherwise in breach
   of the applicable anti-spam and privacy laws (see the Privacy Policy and `CRM-01`); or
9. use the Service to launder money, evade sanctions, or facilitate fraud.

We may investigate suspected breaches and may suspend access under §13 while we do.

## 6. Merchant responsibilities

A Merchant is the seller of record for every order taken through its ShopMaster surfaces.
ShopMaster is a software layer, not the seller, not the merchant of record, and not a party to
the sale between a Merchant and its Customer. Accordingly, the Merchant is responsible for:

- the accuracy of its menu, prices, allergen and dietary information, and its Content;
- charging and remitting the correct taxes (the Service computes jurisdiction-aware tax —
  AU GST-exclusive, NP VAT-inclusive — but the Merchant remains the taxpayer, `POS-10`/`LOC-02`);
- fulfilling orders, handling refunds, complaints, and consumer-law obligations to its Customers;
- holding its own valid payment-account relationships (`PAYINT §1`); and
- complying with the licensing, food-safety, and record-keeping rules of its jurisdiction,
  including Nepal IRD/CBMS invoicing where applicable (`LOC-03/04`).

## 7. Payments — ShopMaster never holds your money

The single most important thing to understand about payments through the Service (`PAYINT §1`):

- **ShopMaster never holds, pools, or redistributes customer or merchant funds.** Every payment
  settles **directly** to the relevant Merchant's own account — their own Fonepay/bank
  registration, their own eSewa or Khalti wallet, their own Tyro Transaction Account. The
  Service only calls that Merchant's own credentials to initiate and confirm a transaction.
- ShopMaster is **not** a bank, a payment service provider, a payment system operator, a
  remittance provider, or a digital currency exchange, and does not act as one.
- No raw card data ever touches ShopMaster's servers or devices; card payments are tokenised
  through PCI-DSS-compliant processors (`PAY-07`, `BE-09`).
- Payment Rails are operated by third parties under their own terms. Their availability,
  settlement timing (e.g. same-day Tyro vs T+1 NepalQR), fees, and disputes are between the
  Merchant and that provider. We are not responsible for a Payment Rail's acts or omissions.

## 8. Availability, offline operation, and data

- We aim to keep the Service available but do not warrant uninterrupted or error-free operation.
  Planned maintenance, third-party outages, and connectivity loss can interrupt it.
- The offline-first design means some data (orders taken offline) exists only on a device until
  it syncs. You are responsible for the devices you run the Service on and for allowing them to
  sync. We are not liable for data that never reached us because a device was lost, wiped, or
  never reconnected before failing.
- On a genuine cross-device conflict, the Service resolves deterministically (earliest device
  timestamp wins) and preserves the losing edit in the audit trail (`DB-09`); this is by design,
  not a fault.

## 9. Intellectual property

- The Service, its software, and its trade marks are owned by ShopMaster or its licensors. These
  Terms grant you a limited, revocable, non-exclusive, non-transferable right to use the Service
  during your subscription, and nothing more.
- A Merchant retains all rights in its own Content and Order Records. The Merchant grants us a
  licence to host, process, transmit, and display that Content and data only as needed to
  provide the Service, to keep it secure, and as the Privacy Policy describes.
- If you give us feedback or suggestions, we may use them without obligation to you.
- The "ShopMaster" name is not yet cleared for trade-mark use in either market (`GAP-11`); this
  clause must be revisited once that check completes.

## 10. Disclaimers

To the maximum extent permitted by law, and subject to §11:

- the Service is provided **"as is"** and **"as available"**, without warranties of any kind,
  express or implied, including merchantability, fitness for a particular purpose, and
  non-infringement;
- we do not warrant that the Service will meet your requirements, be uninterrupted, secure, or
  error-free, or that reported figures (including tax computations and reports) are free of error
  — a Merchant remains responsible for verifying its own tax and financial reporting; and
- the mock/stubbed integrations described in our documentation (e.g. non-Cash payment adapters in
  a pre-production build) do not move real money and must not be relied on as live payment
  processing.

## 11. Australian Consumer Law and other non-excludable rights

Nothing in these Terms excludes, restricts, or modifies any consumer guarantee, right, or remedy
that cannot lawfully be excluded, including under the **Australian Consumer Law** (Schedule 2 to
the *Competition and Consumer Act 2010* (Cth)) or under the equivalent consumer-protection law of
Nepal. Where the Service is supplied to a person as a "consumer" under the Australian Consumer
Law and the guarantees apply, and where we are permitted to limit our liability, our liability is
limited (at our option) to re-supplying the Service or paying the cost of having it re-supplied.
The limits in §12 apply only to the extent the law allows.

## 12. Limitation of liability

Subject to §11:

- Neither party is liable to the other for indirect, incidental, special, consequential, or
  punitive loss, or for loss of profit, revenue, goodwill, anticipated savings, or data, however
  caused, even if advised of the possibility.
- Our total aggregate liability arising out of or in connection with the Service and these Terms,
  in any 12-month period, is limited to **[the greater of the fees paid by the relevant Merchant
  to ShopMaster in that period / AUD 100 — CONFIRM WITH COUNSEL]**. For a free-tier Starter
  Merchant or a Customer who pays us nothing, that cap is a nominal amount to be set on review.
- We are not liable for loss arising from a Payment Rail, a Customer's or Merchant's own acts, a
  device you control, connectivity loss, or your failure to keep credentials secure.

## 13. Suspension and termination

- **You** may stop using the Service at any time; a Merchant's paid subscription ends per the
  Merchant Agreement.
- **We** may suspend or terminate access immediately where we reasonably believe there is a
  breach of §5 (Acceptable use), a security or legal risk, non-payment (for a Merchant, per the
  Merchant Agreement), or a legal requirement to do so.
- On termination: your right to use the Service ends; the data-handling and return/deletion rules
  in the Privacy Policy (§7, retention) and the Merchant Agreement (data export on exit) apply;
  and the clauses that by their nature survive (definitions, IP, disclaimers, liability,
  indemnity, governing law) continue.

## 14. Changes to the Service and to these Terms

We may update these Terms. For a material change we will give reasonable prior notice (for a
Merchant, per the Merchant Agreement's notice mechanism; for a Customer, by posting the updated
Terms). Continued use after a change takes effect is acceptance of it. If you do not accept a
material change, stop using the Service before it takes effect.

## 15. Governing law and disputes

- **[GOVERNING LAW — TBD, see GAP-01.]** The intended structure is that a Merchant's relationship
  is governed by the law of its operating jurisdiction — the law of the relevant state of
  **Australia** for an Australian Merchant, and the law of **Nepal** for a Nepal-based Merchant —
  with the seat and exclusive/non-exclusive jurisdiction to be fixed on review once the operating
  entity is chosen.
- Nothing in this clause deprives a Customer of the protection of the mandatory consumer law of
  the place they order from.
- The parties will attempt to resolve a dispute in good faith before commencing proceedings.

## 16. General

- **Assignment.** You may not assign these Terms without our consent; we may assign them to an
  affiliate or successor.
- **No waiver.** A failure to enforce a term is not a waiver of it.
- **Severability.** If a term is unenforceable, the rest continues.
- **Entire agreement.** These Terms, the Merchant Agreement (for a Merchant), and the Privacy
  Policy are the entire agreement about the Service.

## 17. Contact

Questions about these Terms: **[LEGAL/SUPPORT CONTACT — TBD]**, ShopMaster,
**[REGISTERED ADDRESS — TBD, see GAP-01]**.

---

*End of draft. This document is intentionally incomplete: every `[PLACEHOLDER]` and the entity,
governing-law, liability-cap, and trade-mark items must be settled by qualified counsel admitted
in Australia and Nepal before use.*
