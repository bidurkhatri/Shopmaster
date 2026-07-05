**DRAFT — NOT LEGAL ADVICE — REQUIRES REVIEW BY QUALIFIED COUNSEL (Australia + Nepal)**

# ShopMaster — Privacy Policy

| | |
|---|---|
| **Product** | ShopMaster |
| **Document type** | Legal draft — Privacy Policy |
| **Version** | 0.1 — Draft for counsel review |
| **Date** | 5 July 2026 |
| **Status** | **DRAFT.** Placeholder pending the legal-entity decision (GAP-01) and formal review. Closes **GAP-02** (one of three). Companion to the Data Breach Response Plan gap (`GAP-10`). |

> **This describes how the ShopMaster software is designed to handle personal information; it
> is not a certified compliance statement.** The identity of the data controller/"APP entity",
> the exact retention periods, and the Nepal posture all depend on decisions counsel must make
> (GAP-01, and Nepal's data-protection framework is still developing). Do not publish or rely on
> this until reviewed by a qualified lawyer admitted in **both** Australia and Nepal. Requirement
> IDs (`CRM-01`, `DB-14`, `DB-15`, `PAY-07`, `BE-10/11`) reference the ShopMaster specification in
> `docs/`.

---

## 1. Who this Policy is for, and the roles involved

ShopMaster is a multi-tenant platform (`BE-10/11`). Personal information flows through it in two
distinct roles, and this matters for who is legally responsible:

- **ShopMaster as processor.** For the personal information of a Merchant's **Customers** (a
  diner who places a QR/online order, an opt-in loyalty contact), the **Merchant is the primary
  controller** of that information and ShopMaster processes it on the Merchant's behalf and
  instructions, to provide the Service. The Merchant Agreement records this split.
- **ShopMaster as controller.** For the personal information of the **Merchant's own account
  holders and staff** (the owner who signs up, the staff whose PIN we store), ShopMaster is the
  controller.

This Policy explains both. Where the Merchant is the controller, its own privacy notice to its
Customers governs the Merchant–Customer relationship as well.

## 2. The frameworks we build to

- **Australia.** We build to the **Privacy Act 1988 (Cth)** and the **Australian Privacy
  Principles (APPs)** for Australian Merchants and their Customers, including the **Notifiable
  Data Breaches (NDB) scheme** in Part IIIC (see §8).
- **Nepal.** For Nepal-based Merchants and their Customers, we build to Nepal's developing
  data-protection posture — the right to privacy under the Constitution of Nepal and the
  **Individual Privacy Act, 2075 (2018)** and its regulation — recognising that Nepal does not
  yet have a single comprehensive data-protection statute equivalent to the Privacy Act, and that
  this section must be reconfirmed as that framework develops (`GAP-10`, and PRD §11 flags this as
  "needs legal review, not assumed here").
- Where the two regimes differ, we apply the stricter handling by default rather than the looser.

## 3. What personal information we collect

| Category | Examples | Whose | Why | Notes |
|---|---|---|---|---|
| **Merchant account** | Business name, owner email, password (hashed), tier, contact details, branding | Merchant / owner | Create and run the account, billing, support | Controller: ShopMaster |
| **Staff records** | Staff name, role, and a **salted hash of the numeric PIN** — never the PIN itself | Merchant Staff | Two-tier auth: offline staff switching (`STAFF-01`, Auth-Flow Tier 2) | PIN is one-way hashed (`bcrypt`); not recoverable, only resettable |
| **Device / session** | Device identifier, credential fingerprint, last-seen, IP, sync state | Merchant Staff | Pair and revoke devices (`DEVICE-02`), offline sync (`SYNC-01..05`), security | — |
| **Order data** | Items, quantities, prices, table/QR token, timestamps, staff who took the order, the append-only order-event log | Customer + Merchant | Take and fulfil orders, kitchen routing, reporting (`DB-06..DB-10`, `RPT-01`) | An order **may** contain a Customer name/phone/delivery address if the Customer provides one |
| **Payment metadata** | Rail used, amount, status, processor **token** | Customer + Merchant | Record that a payment occurred and reconcile it | **No raw card number is ever stored** — tokenised through PCI-DSS-compliant processors (`PAY-07`, `BE-09`) |
| **Opt-in customer profile** | Contact method (phone/email), repeat-order history, marketing opt-in flag | Customer | Loyalty and, if opted in, order-ready and marketing messages (`CRM-01`, `CRM-03`) | **Opt-in only** — built from online-ordering accounts or repeat QR/phone activity, never without consent |

We do **not** intentionally collect special-category / sensitive information (health, religion,
etc.), and Merchants must not use free-text order fields to record it.

## 4. Opt-in customer profiles (CRM-01) — the consent rule

The lightweight customer profile is **opt-in only** (`CRM-01`). A Customer's contact details are
turned into a marketing-capable profile only where that Customer has affirmatively opted in (for
example, by creating an online-ordering account and consenting, or by explicitly agreeing to
receive messages). A Customer who simply scans a QR code to pay a bill is **not** thereby enrolled
in marketing. Marketing messages (SMS/WhatsApp under `CRM-03`) go only to opted-in contacts,
carry an opt-out, and honour it. Sending to a non-opted-in Customer is a breach of these terms and
of the acceptable-use rule in the Terms of Service §5.

## 5. How we use personal information

We use it to: provide and operate the Service; authenticate users and secure the platform; sync
offline data; compute tax and generate the Merchant's own reports; process payments through the
Merchant's own rails; send transactional messages (order-ready) and, where opted in, marketing on
the Merchant's behalf; provide support; meet legal, tax, and audit obligations (including Nepal
IRD/CBMS invoice fields for in-scope Merchants, `DB-11`/`LOC-03`); and detect and prevent fraud,
abuse, and security incidents. We do **not** sell personal information, and we do not use one
Merchant's Customer data to benefit another Merchant.

## 6. Who we share it with

- **Sub-processors / infrastructure** — hosting, secrets management, and (post-MVP) queueing and
  messaging providers, under contract and only as needed to run the Service (`PLAT-14`).
- **Payment Rails** — the Merchant's own payment providers, which receive the transaction data
  needed to process a payment to the **Merchant's own account**; ShopMaster never pools or holds
  funds (`PAYINT §1`).
- **The Merchant** — a Merchant can access the Customer and order data within its own tenant.
- **Legal / regulators** — where required by law, or to protect rights and safety, including the
  in-country Nepal audit feed for in-scope Merchants (`DB-11`).

Tenant isolation (`BE-10/11`) is enforced so one Merchant cannot access another's data; a
dedicated test strategy for this is tracked separately (`GAP-05`).

## 7. Retention and deletion — soft-delete then scheduled hard-delete (DB-14)

- **Deletion requests use soft-delete followed by a scheduled hard-delete, not immediate
  irreversible deletion** (`DB-14`). When a Customer (via a Merchant) or a Merchant requests
  deletion of personal information, the record is first soft-deleted — removed from active use and
  from view — and then permanently hard-deleted by a scheduled job after a short grace window. The
  grace window exists so a mistaken or malicious deletion is recoverable; it is **not** a way to
  keep data indefinitely. **[EXACT GRACE-WINDOW LENGTH — TBD, CONFIRM WITH COUNSEL against APP
  11.2 and the Nepal framework.]**
- **Audit trail is retained longer, on purpose.** The audit log (`AuditLogEntry`) has a
  deliberately longer retention policy than Customer PII because its value is historical and
  shortening it to match would quietly weaken the discount/void/refund audit trail (`DB-15`,
  `ADMIN-07`). Audit entries are minimised and pseudonymised where practicable.
- We keep account, transaction, and tax records for as long as needed to provide the Service and
  for the period tax and record-keeping law in each market requires, then delete or de-identify.
- APP 11.2 (and its Nepal equivalent) requires destroying or de-identifying personal information
  no longer needed for a permitted purpose; the scheduled hard-delete job is how the Service meets
  that, subject to the retention exceptions above.

## 8. Data breaches — Notifiable Data Breach scheme

If we or a Merchant become aware of unauthorised access to, disclosure of, or loss of personal
information, we will assess it promptly. Where an eligible data breach is likely to result in
serious harm and cannot be remediated in time, we will comply with the **Notifiable Data Breaches
(NDB) scheme under Part IIIC of the Privacy Act 1988 (Cth)** — notifying the **Office of the
Australian Information Commissioner (OAIC)** and affected individuals as required — and with the
equivalent notification expectations of the Nepal framework as it applies. Because ShopMaster is
often a processor for Customer data, the breach-response roles between ShopMaster and the Merchant
are set out in the Merchant Agreement, and the standing **Data Breach Response Plan is tracked as
`GAP-10`** and must be completed alongside this Policy before genuine Customer data is at scale.

## 9. Security

- Passwords and staff PINs are stored only as salted hashes; PINs are never recoverable
  (`STAFF-01`).
- No raw card data is stored anywhere in ShopMaster — payments are tokenised through
  PCI-DSS-compliant processors (`PAY-07`, `BE-09`).
- Access is role-based (`STAFF-01`), tenants are logically isolated (`BE-10/11`), public
  endpoints are rate-limited (`BE-13`), and secrets are held in a dedicated secrets manager, not
  in committed config (`PLAT-14`).
- No system is perfectly secure; we cannot guarantee absolute security, and §8 governs what
  happens if something goes wrong.

## 10. Your rights and choices

Subject to the applicable law and to identity verification, an individual may request to access,
correct, or delete their personal information, and may opt out of marketing at any time. A
Customer generally exercises these rights through the **Merchant** they ordered from (because the
Merchant is the controller of that data); ShopMaster will support the Merchant in honouring a
valid request, including running the soft-delete/hard-delete flow (`DB-14`). A Merchant account
holder or staff member exercises these rights with ShopMaster directly.

Under the Australian Privacy Act you may also complain to us and, if unsatisfied, to the **OAIC**.
The Nepal complaint pathway will be confirmed on review.

## 11. Cross-border data

Personal information may be processed on infrastructure located outside the Merchant's country
(for example, an Australian or regional data centre). Where we transfer personal information
across a border, we take reasonable steps so it is handled consistently with the frameworks in §2
(APP 8 for Australian data, and the Nepal posture). **[HOSTING LOCATIONS AND TRANSFER MECHANISM —
TBD, CONFIRM WITH COUNSEL; this interacts with the Nepal in-country audit-server requirement
`PLAT-07`/`DB-11`.]**

## 12. Children

The Service is a business tool for Merchants and is not directed at children. We do not knowingly
collect a child's personal information beyond an incidental order a Merchant might take.

## 13. Changes to this Policy

We may update this Policy. For a material change affecting how we handle personal information, we
will give reasonable notice through the Service or to the Merchant. Continued use after the change
takes effect is acceptance.

## 14. Contact and complaints

Privacy questions, requests, and complaints: **[PRIVACY CONTACT / DPO — TBD]**, ShopMaster,
**[REGISTERED ADDRESS — TBD, see GAP-01]**.

---

*End of draft. This document is intentionally incomplete: the controller identity, retention
periods, hosting/transfer details, and the Nepal-specific posture must be settled by qualified
counsel admitted in Australia and Nepal, and the Notifiable Data Breach response plan (`GAP-10`)
must be completed alongside it, before use.*
