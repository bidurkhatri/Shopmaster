# ShopMaster — Data Breach Response Plan

Closes **GAP-10**. Australia's **Notifiable Data Breaches (NDB) scheme** — Part IIIC of the
*Privacy Act 1988* (Cth), administered by the Office of the Australian Information Commissioner
(OAIC) — is a specific, real obligation the moment genuine customer personal information exists in
ShopMaster. This document is the pre-agreed runbook so that fact is not discovered mid-incident. It
sits alongside [`SECURITY.md`](./SECURITY.md) (the controls that prevent a breach) and
[`OBSERVABILITY.md`](./OBSERVABILITY.md) (how a breach gets *detected*).

> **This plans for the obligation; it does not substitute for verifying it.** Same posture as
> PLAT-09 in the [Platform Architecture](../02-architecture/Shopmaster_Platform_Architecture.md):
> everything below is written against publicly reported OAIC guidance and the *Privacy Act*. Before
> a real merchant's real customer data is live, this runbook must be reviewed and signed off by
> Australian-licensed privacy counsel — and the answer depends on **GAP-01** (legal entity) and
> **GAP-02** (Privacy Policy), neither of which is resolved yet. The Nepal side has **no NDB
> equivalent to rely on**; §7 covers that gap explicitly.

---

## 1. What personal information ShopMaster actually holds

You cannot assess a breach without knowing what is at stake. ShopMaster's data model is
deliberately lean, which shrinks the blast radius — but it is not zero.

| Data | Where it lives | Sensitivity |
|---|---|---|
| Customer name, phone, delivery address | `CustomerProfile`, and inline on public QR/online orders (`POST /public/orders`) | Personal information — the core NDB concern |
| Staff name, role, email, **bcrypt password/PIN hash** | `StaffMember` | Personal information + credential material (hashed, never plaintext — see [`SECURITY.md`](./SECURITY.md) §6) |
| Order contents, totals, per-rail payment records | `Order`, `OrderItem`, `Payment` | Commercial; totals are integer **minor units**, not card data |
| Audit trail — every discount/void/refund/config change | `AuditLogEntry` (ADMIN-07) | Internal; the forensic record you *use* during a breach |

**What ShopMaster deliberately does not hold: raw card data.** PAY-07 tokenization means no PAN,
CVV, or magnetic-stripe data ever reaches ShopMaster storage — adapters return only a processor
token (`packages/core/src/payments/index.ts`). A card-data breach of ShopMaster's own systems is
**out of scope by construction**, not by luck. That single design choice removes the highest-harm
category of breach from this plan; keeping it true is a launch-blocking security invariant, not a
convenience.

---

## 2. Roles

Named roles, not job titles — one person may hold several at ShopMaster's current size, but the
*responsibility* must be pre-assigned so no one is improvising who-does-what during an incident.

| Role | Responsibility |
|---|---|
| **Breach Response Lead** | Owns the incident end to end: convenes the response, makes the "eligible data breach?" call with counsel, signs off notifications. The single accountable person. |
| **Privacy Officer** | Owns the OAIC relationship and the notification statement; keeps the incident register (§6). May be the same person as the Lead early on. |
| **Engineering on-call** | Contains the breach technically (revoke credentials, rotate secrets, close the hole), pulls forensic evidence from logs (`OBSERVABILITY.md`) and the `AuditLogEntry` trail. |
| **Legal counsel** | Australian-licensed privacy lawyer (external until GAP-01 resolves). Confirms whether the *serious harm* test is met and reviews every external communication. |
| **Communications** | Drafts affected-individual and (if needed) public messaging, in plain language, in EN and NE where the merchant serves Nepali customers. |

The **merchant is a stakeholder, not a bystander.** ShopMaster is a processor of *their* customers'
data; the response plan includes notifying the affected merchant promptly so they are never blindsided
by their own customers being contacted.

---

## 3. The four phases

### Phase 1 — Contain (immediately, hours not days)
Stop the bleeding first. Engineering on-call: revoke exposed credentials, rotate the affected
secrets via the secrets manager (PLAT-14), invalidate JWT sessions if session material is implicated
(`SECURITY.md` §5), and close the access path. Preserve evidence *before* changing state where
possible — snapshot logs and the audit trail. Open the incident register entry (§6) now, with a
timestamp.

### Phase 2 — Assess (the 30-day clock)
Under the NDB scheme, once you have reasonable grounds to *suspect* an eligible breach, you have a
**maximum of 30 calendar days** to complete a reasonable and expeditious assessment. Thirty days is a
ceiling, not a target — assess as fast as the facts allow. The test for an **eligible data breach**
is all three of:

1. there is unauthorised access to, unauthorised disclosure of, or **loss** of personal information;
2. this is **likely to result in serious harm** to any of the individuals to whom it relates; and
3. the entity has **not been able to prevent** the likely risk of serious harm with remedial action.

If remedial action in Phase 1 genuinely removes the likely risk of serious harm (e.g. data was
strongly encrypted and keys were not exposed, or access was contained before any exfiltration),
notification may not be required — but that judgement is made **with counsel and written down**, never
assumed away to avoid the paperwork.

### Phase 3 — Notify (as soon as practicable, if eligible)
If the breach is assessed as eligible, notify **as soon as practicable** — do not wait out the clock.
Two audiences:

- **The OAIC** — via the online Notifiable Data Breach form, containing the entity's identity, a
  description of the breach, the kinds of information involved, and the recommended steps for
  individuals.
- **Affected individuals** — the same statement, communicated by the method normally used to contact
  them (for ShopMaster's customers, typically the phone/contact captured with the order). If notifying
  each individual is not practicable, publish the statement and take reasonable steps to publicise it.

Notify the **affected merchant** in parallel — they front their own customers.

### Phase 4 — Review (after the dust settles)
Post-incident review: what let it happen, what detection *should* have caught it earlier (feed this
back into `OBSERVABILITY.md` alert thresholds), and what changes to controls prevent a repeat. Update
this runbook. Close the incident register entry.

---

## 4. Timeline at a glance

| When | What | Owner |
|---|---|---|
| **T+0 (hours)** | Contain, preserve evidence, open incident register, alert the Lead | Engineering on-call |
| **T+0 → suspicion confirmed** | Convene response; engage counsel | Breach Response Lead |
| **≤ 30 days from suspicion** | Complete assessment against the three-part eligibility test | Lead + counsel |
| **As soon as practicable (if eligible)** | Notify OAIC + affected individuals + merchant | Privacy Officer + Comms |
| **Post-resolution** | Review; update controls, alerts, and this document | Lead |

---

## 5. Reference scenarios (pre-thought, not exhaustive)

| Scenario | Likely eligibility posture |
|---|---|
| Attacker exfiltrates a customer table (names, phones, addresses) | **Likely eligible** — serious harm plausible; notify. |
| Cross-tenant leak — one merchant sees another's customer data (a BE-10/11 / GAP-05 isolation failure) | **Likely eligible** and doubly serious — it also breaks the core multi-tenancy promise; treat as sev-1. |
| Stolen/lost staff device with a cached PIN hash and offline order data | Assess: hashes are not plaintext, but offline-cached customer data may be exposed. Counsel call. |
| Payment-token leak (processor tokens only, no card data — PAY-07) | Lower harm by design; tokens are not usable card data. Assess, likely not eligible, **document the reasoning**. |
| Exposed `JWT_SECRET` or DB credential | Security incident → rotate immediately (PLAT-14); becomes a *data* breach only if it led to access to personal information. |

---

## 6. Incident register

Every suspected breach — eligible or not — gets a dated entry: what happened, what was assessed, the
decision and its reasoning, and the outcome. The ones assessed as *not* notifiable matter as much as
the ones that are: the written reasoning is what demonstrates the assessment was actually done, and
it is the first thing the OAIC asks for. The `AuditLogEntry` trail (ADMIN-07) is the immutable
technical companion to this human register.

---

## 7. Nepal — the honest gap

The NDB scheme is **Australian**. Nepal's data-protection regime (the *Individual Privacy Act, 2075*
and related provisions) does not impose an equivalent mandatory-notification obligation in the same
shape, and its practical enforcement is a question for Nepal-licensed counsel — the same unresolved
dependency flagged in PLAT-09 and LOC-03. **This plan does not assume Nepal has no obligations; it
flags that they are unconfirmed.** Until they are: apply the *containment, assessment, and honest
notification of the affected merchant and their customers* spirit of this runbook to Nepali data too,
because the ethical duty to the tea-stall owner's customers does not depend on which statute is easier
to enforce. Finalising the Nepal-specific obligations is tracked as a follow-on to this document.
