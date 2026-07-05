# Shopmaster — Payment Integration Plan

| | |
|---|---|
| **Product** | Shopmaster |
| **Document type** | Sub-system design — Payments |
| **Version** | 0.2 — Draft for review, adds Web3 methods |
| **Date** | 2 July 2026 |
| **Prepared by** | Bidur |
| **Extends** | PRD Section 8.8 (`PAY`), Backend Architecture Section 6 |

## 1. The One Decision That Shapes Everything Else

Shopmaster should never become the entity that holds customers' money, in either country. Every payment method below gets integrated so that funds settle directly into the *merchant's own* account — their own eSewa wallet, their own bank account, their own Tyro Transaction Account — with Shopmaster's software calling that merchant's own credentials to initiate and confirm a transaction, never pooling funds centrally and redistributing them.

This isn't caution for its own sake. In Nepal specifically, an entity that pools and redistributes merchant funds is doing something a licensed Payment Service Provider or Payment System Operator does — and that license carries a paid-up capital requirement in the hundreds of millions of rupees (Section 3). Staying a pure software layer on top of already-licensed rails, the same way any POS vendor sits on top of Tyro in Australia, keeps Shopmaster out of that regulatory category entirely for as long as the "merchant owns their own account" model holds. New IDs here: `PAYINT-##`.

The same principle governs Section 6's Web3 methods, and for the same underlying reason — a business that itself exchanges crypto for fiat is a Digital Currency Exchange in Australia's eyes just as surely as it's a PSP in Nepal's, and both trigger licensing this plan is deliberately built to avoid.

## 2. Nepal — Web2 (Fiat) Methods by Context, Flow, and Ease

| Method | Real context | Flow | Integration ease | Settlement |
|---|---|---|---|---|
| **Cash** | Still dominant below the café/restaurant tier — the default for a one-person tea stall | Staff enters amount tendered, POS calculates change (POS-01) | Trivial — no external integration | Instant, in hand |
| **NepalQR via Fonepay** | Nepal's interoperable QR standard — one QR code, scanned by any participating bank or wallet app, including eSewa and Khalti themselves | Merchant displays a static or per-bill dynamic QR; customer scans with whatever app they already have; both sides get real-time confirmation | Moderate — merchant registers once (via their bank, or directly with Fonepay), receives a merchant ID, Shopmaster's POS generates the QR against that ID per order | T+1 to the merchant's bank account, per current public guidance |
| **eSewa (merchant gateway)** | Nepal's largest wallet by user share; strong for online checkout specifically | Redirect-based payment flow — customer is sent to eSewa to authorize, then returned to Shopmaster with a confirmation token | Moderate — eSewa has a documented merchant API distinct from its QR presence; requires its own merchant registration | Settles to the merchant's eSewa wallet first, withdrawable to bank |
| **Khalti (merchant gateway)** | Nepal's second major wallet, meaningful independent user base | Same shape as eSewa — redirect/token-based checkout | Moderate — separate merchant registration and API credentials from eSewa | Settles to the merchant's Khalti wallet, withdrawable to bank |
| **IME Pay and smaller wallets** | Present, meaningful for specific customer segments, not close to eSewa/Khalti/Fonepay's combined reach | Broadly similar QR or redirect pattern | Lower priority — worth a real adapter once a merchant specifically asks, not before | Wallet-first, withdrawable |
| **ConnectIPS** | More a bank-account-linked payment gateway than a retail POS tender — better fit for larger tickets or the branded online-ordering checkout than a tea-stall counter | Customer logs into their bank via ConnectIPS to authorize | Moderate, closer to eSewa/Khalti's integration shape | Direct to merchant bank account |
| **Card via bank POS terminal** | Meaningful mainly at hotels and restaurants serving tourists or expats; largely absent below that tier | Standard card-present terminal flow through a Nepali acquiring bank | Higher — a separate acquiring relationship per bank, less standardized than the QR ecosystem | Bank-dependent, typically T+1 to T+2 |
| **FoneTAG (Fonepay's tap mechanism)** | A tap-based payment option that Fonepay markets as working without an internet connection | Not yet confirmed in enough technical depth to specify a flow here | Unknown — flagged in Section 6 as worth a real technical evaluation, not assumed | Unconfirmed |

The practical recommendation: **NepalQR via Fonepay is the default rail for every in-person and QR/NFC-table order** (PRD `QR`/`NFC` modules), precisely because it's the one method that doesn't force a merchant or a customer to pick a specific wallet — it's already interoperable across the ecosystem those merchants' customers are using. **eSewa and Khalti's dedicated merchant gateways are the better fit specifically for branded online ordering** (`WEB`), where a proper redirect-and-return checkout flow matters more than a QR a customer scans in person — worth noting plainly that Fonepay's own public-facing integration is built for physical QR and mobile banking rather than a full e-commerce API, so leaning on it for the online checkout would be fighting the tool.

## 3. Nepal — the Regulatory Structure Behind Section 1

- **PAYINT-01** Nepal Rastra Bank licenses two distinct categories: Payment Service Providers (PSPs — eSewa, Khalti, IME Pay, and similar, who face the customer directly) and Payment System Operators (PSOs — Fonepay, SCT, and similar, who run the underlying interoperable infrastructure). A single company cannot hold both licenses at once, and both carry paid-up capital requirements well into the hundreds of millions of rupees, higher again for foreign-invested applicants.
- **PAYINT-02** Foreign ownership up to roughly 80% is permitted in a PSP/PSO with minimum foreign direct investment around NPR 20 million — worth knowing this path exists, but it's a heavy, multi-month regulatory undertaking, not a Phase 1 decision.
- **PAYINT-03** None of that licensing is required for Shopmaster as specified in Section 1 — a software company integrating with already-licensed PSPs and PSOs on behalf of merchants who hold their own accounts is a fundamentally lighter regulatory position, the same category Tyro's 450+ integrated POS partners in Australia sit in relative to Tyro itself.
- **PAYINT-04** Worth flagging directly, given the earlier PRD note on this: if a Nepal-based development or operations entity does end up standing up (the Kailali software-entity research flagged in the original PRD's open questions), that entity is a plausible future vehicle for a deeper local payments relationship — but that's a strategic option to keep open, not something this plan assumes or requires for launch.

## 4. Australia — Web2 (Fiat) Methods by Context, Flow, and Ease

| Method | Real context | Flow | Integration ease | Settlement |
|---|---|---|---|---|
| **Cash** | Present everywhere, meaningfully less dominant than in Nepal given very high card/contactless adoption | Same as Nepal — trivial POS tender | Trivial | Instant |
| **Tyro EFTPOS** | Australia's largest EFTPOS provider outside the big-four banks, purpose-built to embed inside third-party hospitality and retail POS software rather than compete with it — already integrated with 450+ POS/PMS systems | POS sends the bill total to a paired Tyro terminal (or the terminal pulls it, for Pay@Table); customer taps, swipes, or inserts; terminal confirms back to POS for automatic reconciliation | Low-to-moderate — Tyro's integration APIs are specifically designed for this exact use case, with hospitality-specific primitives (Pay@Table, split bills, tipping, surcharging) that map closely onto `POS-03`/`POS-04`/`PAY-06` | Same-day, into the merchant's own Tyro Transaction Account |
| **Tyro eCommerce** | The online counterpart to the same provider — same merchant, one reconciliation view across in-person and online | Standard hosted or API-based online checkout | Low-to-moderate, and pairing it with Tyro EFTPOS keeps one vendor relationship instead of two | Same-day |
| **Apple Pay / Google Pay** | Extremely common as a tap method in Australia | Rides on top of the Tyro terminal's existing contactless acceptance — no separate integration | Already covered by the Tyro EFTPOS integration | Same as underlying card rail |
| **PayID / PayTo** | Real-time bank-to-bank payment, growing but still more established for peer-to-peer and bill payments than counter-service retail | Customer authorizes a bank-to-bank transfer via their banking app | Emerging — worth watching, not building for MVP | Real-time, direct to merchant bank account |
| **Stripe (alternative for `WEB` specifically)** | Strong developer experience, very mature for card-not-present/online checkout, weaker historical footprint in Australian in-person terminal hardware | Standard hosted or Elements-based checkout | Low for online-only use, but would mean a second vendor alongside Tyro rather than one unified relationship | Payout schedule per Stripe's standard terms |

## 5. Why Tyro Over the More Obvious Answer

Square is the name that comes up first for POS payments, including in Australia, and it's deliberately not the primary recommendation here — Square is itself a POS competitor in the PRD's own competitive landscape section, and routing Shopmaster's Australian transaction volume through a direct competitor's rails is an odd position for a product built to compete with exactly that kind of all-in-one player. Tyro doesn't sell POS software; it sells payments infrastructure that POS software vendors embed, which is precisely the relationship Shopmaster needs, and its scale (450+ existing POS integrations) means this is a well-worn integration path, not a novel one.

## 6. Web3 (Stablecoin) Methods — By Country

### 6.1 Nepal — Not Viable at the Point of Sale, and This Needs to Be Said Plainly

Cryptocurrency, explicitly including stablecoins, is illegal in Nepal — not under-regulated, not a gray area, illegal. Nepal Rastra Bank's Foreign Exchange Management Department has reinforced this position through public notices since August 2017, most explicitly in an August 2022 notice that named stablecoins specifically as covered by the ban, and the legal basis runs through the Foreign Exchange (Regulation) Act 2019, the Nepal Rastra Bank Act 2058, and — as of the current Muluki Criminal Code — a dedicated criminal provision. "Accepting payment in" cryptocurrency is explicitly named among the prohibited activities, not just trading or holding it. Penalties run to imprisonment and fines of multiples of the transaction value, with asset forfeiture on top. A Supreme Court challenge to the ban was dismissed in 2022, and the only forward motion from NRB is a two-tier Central Bank Digital Currency pilot — state-issued, state-controlled, and explicitly framed as the alternative to private crypto rather than a path toward legalizing it. It hasn't reached commercial rollout as of mid-2026.

This is the same constraint already shaping DOKO and NepaliPay's own design — both serve Nepali diaspora and international earners transacting in USDC/USDT *outside* Nepal, not a mechanism for accepting stablecoin payment at a register inside the country. That same boundary applies here without exception: **no Web3 payment method in this plan is built for a Nepal-based merchant.** If NRB's CBDC pilot reaches commercial rollout, it would be worth its own document at that point — it's a fundamentally different, state-sanctioned instrument, not an extension of this section.

### 6.2 Australia (and Other Viable Markets) — by Context, Flow, and Ease

| Method | Real context | Flow | Integration ease | Settlement |
|---|---|---|---|---|
| **Direct stablecoin wallet transfer (USDC/USDT)** | A customer with their own crypto wallet pays a merchant's wallet address directly — most relevant for tourist-heavy or crypto-native customer bases, not a mainstream expectation yet | Merchant's POS generates a payment request (amount + destination address); customer approves the transfer from their wallet app via WalletConnect or a similar signing protocol; POS watches the chain for confirmation | Moderate — no licensed intermediary needed technically, but building reliable on-chain confirmation watching and handling variable confirmation times is real engineering work | Near-instant to a few seconds/minutes depending on chain, direct to the merchant's own wallet, no intermediary settlement lag at all |
| **QR-based stablecoin checkout (Solana Pay-style protocol)** | A purpose-built standard for exactly this use case — point-of-sale crypto payment via QR code, deliberately designed to feel like scanning any other payment QR | Same UX shape as NepalQR or a Tyro tap — customer scans, wallet app opens pre-filled, approves, done | Moderate — the protocol itself is designed to be straightforward to integrate; the surrounding chain-confirmation and reconciliation work is the same lift as the row above | Same as underlying chain |
| **Custodial crypto payment processor** (Coinbase Commerce-style) | Abstracts the chain away entirely — merchant gets a simple invoice/QR, processor handles wallet interaction and confirmation, can auto-convert to fiat or leave the merchant holding stablecoin | Closest in shape to a Web2 payment gateway from the merchant's point of view | Low — genuinely comparable integration effort to eSewa or Stripe, at the cost of a third-party processor sitting in the middle | Processor-dependent, typically fast |
| **Bridge-orchestrated settlement** | Worth evaluating given the standing relationship and confirmed fee structure from DOKO's build (Bridge's 0.75% internal cost, 1.50% developer fee) — Bridge's core strength is stablecoin orchestration, and whether it has a merchant-payment-acceptance product distinct from its remittance-orchestration role is worth a direct conversation, not assumed here | Would depend entirely on what Bridge actually offers for this specific use case | Unknown until that conversation happens | Unknown |
| **DOKO / NepaliPay wallet-native payment** | A genuinely differentiated option no generic POS competitor can offer — a customer who already holds a DOKO or NepaliPay balance pays a Shopmaster merchant directly from that wallet | "Pay with DOKO" / "Pay with NepaliPay" as a checkout option, functionally similar to the custodial-processor row but on infrastructure already owned | Depends on what DOKO/NepaliPay's own APIs currently expose for third-party merchant acceptance — flagged in Section 10 as worth scoping, not assumed built already | Whatever DOKO/NepaliPay's own settlement model already is |

### 6.3 The Regulatory Posture in Australia — Same Principle, Genuinely Live Transition

- **PAYINT-05** Any Australian business that exchanges digital currency for fiat currency, or fiat for digital currency, as part of its operations must register with AUSTRAC as a Digital Currency Exchange provider — operating without that registration is a criminal offence, the direct AUSTRAC counterpart to Nepal's PSP/PSO structure in Section 3.
- **PAYINT-06** The same "software layer, not licensed intermediary" posture from Section 1 keeps Shopmaster out of DCE territory: if actual crypto-to-fiat conversion is routed through an already-registered third-party processor (the custodial-processor row above) rather than Shopmaster doing that exchange itself, and Shopmaster's own crypto-adjacent activity stays genuinely incidental to what is fundamentally a POS/ordering business, that's the kind of fact pattern the "incidental or insignificant activity" exemption in Australia's current framework is meant to cover. That's a real legal question to confirm with counsel, not a conclusion this document can finalize.
- **PAYINT-07** Worth flagging as unusually time-sensitive rather than settled background: Australia's digital-asset regulatory framework is mid-transition right now. An AUSTRAC scope expansion took effect 31 March 2026, and a parallel ASIC framework requiring an Australian Financial Services Licence for larger digital-asset platforms had a transitional no-action protection that expired 30 June 2026 — two days before this document's date. This is a genuinely less settled area than the fiat side of this plan, and it's worth specialist review before any Web3 feature ships in Australia, not just a read of this section. Given the AUSTRAC compliance work already built for DOKO, that specialist conversation is one this team is unusually well positioned to have quickly.

### 6.4 Chain and Asset Choice

- **PAYINT-08** USDC as the primary asset — the strongest institutional backing and issuer transparency of the major stablecoins — with USDT worth supporting as a close second given its dominance in exactly the remittance-adjacent, diaspora-facing use cases the rest of this portfolio already serves.
- **PAYINT-09** Ethereum mainnet is not a reasonable settlement chain for point-of-sale transactions at this price point — gas fees alone could exceed the price of the item being purchased. The real candidates are Solana (fast, cheap, and the chain the Solana Pay protocol in Section 6.2 is built around) and Polygon (already the chain Veridity runs on, which means real, existing team familiarity). Worth a genuine technical spike between the two rather than a default pick here.

### 6.5 Sequencing

Web3 sits deliberately outside every phase in Section 8 — not because it isn't worth building, but because Section 6.1 rules out Nepal entirely and Section 6.3 flags Australia as mid-transition right now. The honest position: worth a dedicated evaluation once the AUSTRAC/ASIC framework settles and the Bridge/DOKO-NepaliPay questions in Section 10 have real answers, not something to bolt onto the Phase 1 build.

## 7. Ease-of-Integration Ranking, Across Both Countries and Both Webs

Ordered from least to most integration effort, which doubles as a reasonable build sequence for the Payments Abstraction adapters (Backend Architecture Section 6):

1. **Cash** (both countries) — no adapter beyond the existing POS tender UI.
2. **Tyro EFTPOS** (Australia) — a single, well-documented, purpose-built integration.
3. **NepalQR / Fonepay** (Nepal) — one merchant registration, one QR-generation integration, but T+1 settlement and a less mature developer-facing API surface than Tyro's.
4. **Tyro eCommerce or Stripe** (Australia, online) — same vendor relationship as #2 if Tyro, or a clean but separate one if Stripe.
5. **eSewa and Khalti merchant gateways** (Nepal, online) — two separate registrations and API integrations, each needed specifically for `WEB` rather than for in-person `POS`/`QR`.
6. **IME Pay, ConnectIPS, additional bank card rails** (Nepal) — lower-priority adapters, built on demand once a specific merchant needs them, not spec'd out fully here.
7. **PayID/PayTo** (Australia) — worth revisiting once the standard matures further for retail use.
8. **FoneTAG** — genuinely unknown effort until it's actually evaluated; flagged, not estimated.
9. **Custodial crypto payment processor** (Australia/viable markets) — genuinely comparable effort to a Web2 gateway integration, the easiest entry point into Web3 if that path gets prioritized.
10. **QR-based stablecoin checkout / direct wallet transfer** (Australia/viable markets) — real engineering work around chain-confirmation handling on top of the payment flow itself.
11. **Bridge-orchestrated settlement and DOKO/NepaliPay wallet-native payment** — not rankable yet against the rest of this list, since both depend on conversations and API scoping that haven't happened (Section 10).
12. **Nepal, any Web3 method** — not on this ranking. Not a matter of effort; Section 6.1 rules it out entirely.

## 8. Recommended Build Sequence Against the PRD's Own Phasing

- **Phase 1 (matches PRD Section 6 MVP scope: POS + QR + branded online pickup):** Cash (both markets), Tyro EFTPOS (Australia in-person), NepalQR via Fonepay (Nepal in-person). This covers every Phase 1 channel without touching the online-checkout-specific gateways yet.
- **Alongside `WEB` going live:** Tyro eCommerce or Stripe (Australia online), eSewa and Khalti merchant gateways (Nepal online).
- **Phase 2 and later, on demand:** IME Pay, ConnectIPS, additional card acquiring relationships, a real FoneTAG evaluation, PayID/PayTo.
- **Web3, deliberately unscheduled rather than placed in a phase:** worth building once Section 6.3's regulatory transition settles and the Bridge/DOKO/NepaliPay questions have real answers — Australia-only (or other markets where it's legal) from day one, never Nepal, per Section 6.1.

## 9. Cross-Cutting Considerations

- **Settlement timing is genuinely different across rails, not a rounding error.** Same-day via Tyro versus typical T+1 via NepalQR versus near-instant on-chain for stablecoins is worth surfacing directly in merchant-facing reporting (`RPT-01`), so a merchant isn't confused about why yesterday's sales in one rail aren't where another rail's funds already are.
- **Currency stays cleanly separated by design.** NPR, AUD, and USDC/USDT never need to be reconciled against each other inside the Order or Payment core — the adapter pattern (`PAY-04`, Backend Architecture Section 6) means currency is a property of which adapter ran, not logic the core engine needs to know about.
- **Fee transparency belongs in the merchant-facing reporting from day one**, given how central "commission independence" is to the product's own positioning (PRD Section 5) — a merchant should be able to see exactly what each rail cost them, not just their net total.
- **Stablecoin payments aren't automatically a tax non-event.** Accepting crypto as payment can still trigger GST and CGT considerations for an Australian merchant depending on how it's held afterward — this plan doesn't attempt tax advice, but the merchant-facing reporting should flag it rather than stay silent, the same posture taken with every other compliance-adjacent note in this document.

## 10. Open Questions

- FoneTAG deserves a genuine technical spike given its offline claim lines up directly with `SYNC-01`'s ambitions — this document flags it rather than specifying it because the current research wasn't deep enough to commit to a real integration design.
- Does the "merchant owns their own account" model (Section 1) stay the permanent posture, or is there a future case for a Stripe-Connect-style aggregation model that trades faster merchant onboarding for a heavier regulatory lift, particularly the NRB PSP path in Nepal? Worth treating as a real strategic fork later, not a default to drift into.
- eSewa and Khalti's current merchant gateway fee schedules need confirming directly with each provider — the sourcing behind Section 2 is solid for Fonepay's structure and the NRB licensing framework, less so for exact current gateway pricing.
- Should Tyro's eCommerce product or Stripe be the default for Australian online checkout? Section 4 leans toward Tyro for the single-vendor reconciliation benefit, but that's worth weighing against Stripe's stronger developer tooling once the `WEB` build actually starts.
- What does Bridge actually offer for merchant payment acceptance, distinct from the remittance-orchestration role it already plays for DOKO — worth a direct conversation given the standing relationship, rather than assuming a fit (Section 6.2).
- Do DOKO and NepaliPay's current APIs expose anything a third-party merchant integration could call today, or would "pay with DOKO" at a Shopmaster merchant require new work on those products' own side first?
- Worth calendaring a re-check of Section 6.3's regulatory transition specifically — both the AUSTRAC and ASIC frameworks were actively changing as this document was written, and "genuinely live transition" has a short shelf life as an accurate description.
