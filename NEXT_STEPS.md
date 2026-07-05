# Shopmaster — Gaps & Next Steps

| | |
|---|---|
| **Product** | Shopmaster |
| **Document type** | Handoff — outstanding work |
| **Date** | 5 July 2026 |
| **Prepared by** | Bidur |
| **Purpose** | Everything in this repo is architecture, product, and integration planning. Nothing in it is a legal document, a screen, an API contract, or a test. This document exists so that fact isn't discovered by accident halfway through a build. |

## How to use this document

Each gap has an ID (`GAP-##`) for the same reason every other document in this repo uses IDs — so it can be turned directly into a ticket. Priority reflects how much *other* work is blocked by leaving it alone, not effort to fix.

## Priority 1 — Foundation (nothing else is real without these)

- **GAP-01 — Legal entity structure is still undecided.** Standalone venture, or built under/alongside Fintex Australia — raised as an open question in the original PRD and never resolved across eight further documents. This isn't administrative: it decides who signs a merchant agreement, which compliance regime applies (see GAP-02), and who owns the IP being built from this repo onward.
- **GAP-02 — No Terms of Service, Privacy Policy, or Merchant Agreement exist.** Not drafted, not placeholder — nonexistent. No merchant can be legally onboarded and no customer order legally taken without these. The `doko-austrac-compliance` skill already produces this exact pair for DOKO under an Australian frame — the fastest-closing gap in this entire list, given that precedent.
- **GAP-03 — No real unit economics.** The Starter tier is specified as "free or near-free" (PRD Section 9) and individual costs got flagged piecemeal (Auth0 MAU pricing, Tyro/eSewa/Khalti fees), but nothing has been rolled up into an actual cost-to-serve-one-merchant number, the way DOKO's per-user P&L was built out precisely. Nobody can currently say what a Starter-tier tea stall actually costs Shopmaster to run.

## Priority 2 — Connective Tissue (what makes four documents into one buildable system)

- **GAP-04 — No API contract.** Backend, Frontend, Platform, and Database Architecture all describe a consistent system, but none of them specify actual endpoints, request/response shapes, or error formats. This is the single piece most likely to cause the four documents to quietly drift apart once more than one engineer is building against them.
- **GAP-05 — No test strategy for multi-tenancy isolation.** Platform Architecture's own risk table (Section 9) names this directly: "worth a dedicated test suite, not just code review." It was named as a risk and never turned into a plan.
- **GAP-06 — No test strategy for the SYNC-04 event-log conflict resolution.** The offline order-sync design (Database Architecture Section 4) is exactly the kind of logic that works fine in every manual test and fails only under real concurrent-edit conditions nobody thought to script.

## Priority 3 — The Human Side (the part of the product that's actually the differentiator)

- **GAP-07 — Merchant onboarding flow.** Offered and deferred across three separate conversations now. The PRD's own headline success metric — 15 minutes from signup to first QR order, zero hardware purchased (PRD Section 5) — depends entirely on this flow existing and being good. This is the most-postponed piece of work in the whole project so far.
- **GAP-08 — Zero UI has been designed.** Every document in this repo is architecture-facing: services, schemas, diagrams, requirement lists. For a product whose entire premise is "usable by a first-time tea-stall owner with no training," not one actual screen has been drawn yet.
- **GAP-09 — Hardware compatibility doesn't exist as a real list.** "Certify a known-good printer and card-reader list per market" is a line in a risk table (Platform Architecture, PRD Section 8.13), not an actual list. A merchant literally cannot be told what to buy today.

## Worth Tracking, Lower Urgency Right Now

- **GAP-10 — Data breach response plan.** Australia's Notifiable Data Breach scheme is a specific, real obligation the moment genuine customer data exists in the system — currently unaddressed.
- **GAP-11 — Trademark check on "Shopmaster."** Not verified as clear to use and register in either Nepal or Australia.
- **GAP-12 — No GTM motion.** Go-to-market notes exist at a strategic level (PRD Section 15), but there's no actual plan for how a merchant who isn't already talking to Bidur directly finds and signs up for this product.

## Recommended Immediate Next Step

Given how directly the PRD's own headline metric depends on it, **GAP-07 (merchant onboarding flow)** is the highest-leverage single next deliverable — it's also the piece every other unfinished flow (device pairing from the Auth System document, payment account linking from the Payment Integration plan) already assumes exists. **GAP-02 (ToS/Privacy/Merchant Agreement)** is the close second, specifically because it's the one gap here that isn't a design decision — it's already a known, previously-solved shape of problem given the DOKO precedent.
