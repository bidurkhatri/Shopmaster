# Shopmaster — Product Requirements Document

| | |
|---|---|
| **Product** | Shopmaster |
| **Document type** | Product Requirements Document (PRD) |
| **Version** | 0.1 — Draft for review |
| **Date** | 2 July 2026 |
| **Prepared by** | Bidur |
| **Status** | Draft. Scope, tiering, and phasing are proposals to pressure-test, not decisions already made. |

A note on assumptions before the detail starts: this PRD assumes Nepal and Australia as the two reference markets (given the explicit tea-stall use case and your Sydney base), treats Shopmaster as its own product rather than assuming it sits inside Fintex Australia, and defers a few things — kiosk hardware, NFC, multi-location — to a Phase 2/3 so the MVP stays genuinely buildable. All three are flagged as open questions in Section 18, not silently decided.

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Vision & Product Principles](#3-vision--product-principles)
4. [Target Users & Personas](#4-target-users--personas)
5. [Goals & Success Metrics](#5-goals--success-metrics)
6. [Scope](#6-scope)
7. [Architecture Overview](#7-architecture-overview-conceptual)
8. [Core Modules — Detailed Requirements](#8-core-modules--detailed-requirements)
9. [Tiering & Packaging](#9-tiering--packaging)
10. [Illustrative User Journeys](#10-illustrative-user-journeys)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Technical Architecture](#12-technical-architecture-high-level)
13. [Competitive Landscape](#13-competitive-landscape-directional-non-exhaustive)
14. [Monetization Strategy](#14-monetization-strategy)
15. [Go-to-Market Notes](#15-go-to-market-notes)
16. [Roadmap](#16-roadmap-phased)
17. [Risks & Mitigations](#17-risks--mitigations)
18. [Open Questions](#18-open-questions)
19. [Glossary](#19-glossary)

---

## 1. Executive Summary

Shopmaster is one order engine sold four ways: staff POS, self-service kiosk, QR/NFC table ordering, and a fully branded online ordering site. Instead of building a POS product and bolting ordering channels onto it later, every channel writes to the same menu, the same order record, and the same kitchen queue from day one.

The product has one non-negotiable constraint, and it's the reason this PRD exists: a one-person tea stall in Attariya and a forty-table restaurant in Sydney have to run on the same platform without either one feeling like an afterthought. That means the smallest viable install is a phone with no other hardware and no monthly minimum, and the largest install is a PC-terminal network with kitchen displays, multi-location reporting, and franchise controls — and both are the same codebase in a different configuration, not two different products wearing the same logo.

The second thing worth saying plainly: branded online ordering is currently owned by marketplaces charging 20 to 30 percent commission and keeping the customer relationship for themselves. Shopmaster's online ordering is the merchant's own site, on their own name, and the commission-free positioning against those marketplaces is a real product decision, not a marketing line — it shows up in the requirements below (WEB-06).

## 2. Problem Statement

Small food and drink businesses are effectively locked out of modern ordering and payment tools. Most POS systems are priced and designed around dedicated hardware and restaurant-scale workflows a tea stall or single food truck doesn't need and won't pay for — so they stay on cash and paper, not because they want to, but because nothing on the market fits a one-person operation.

Mid-size and larger restaurants have the opposite problem: they're running four to six disconnected tools — a POS, a separate kiosk vendor, an online ordering aggregator, a loyalty app, printer software that doesn't talk to any of it — and none of them share a menu, an inventory count, or a sales report. Every 86'd item has to be updated in three places by hand. End-of-day reconciliation means stitching together exports from systems that were never meant to agree with each other.

And the online ordering layer specifically has become marketplace-owned. A merchant who wants delivery or pickup ordering online typically ends up on Zomato, UberEats, or Foodpanda, paying a commission on every order and losing the direct customer relationship (no email, no repeat-order data, no ability to message their own customers) in exchange for the traffic.

There's a fourth problem that's more specific to the Nepal/Australia corridor this PRD is written around: cross-border and diaspora-run food businesses need multi-currency, multi-language, and local payment-rail support that Western POS vendors don't prioritize and local Nepali vendors don't always deliver at a modern standard of UX.

## 3. Vision & Product Principles

1. **One engine, many faces.** POS, kiosk, QR, NFC, and online ordering are clients of the same order/menu/inventory core. Nothing is a bolt-on integration.
2. **Progressive complexity.** A tea stall sees three buttons. A forty-cover restaurant sees the full back office. It's the same app with a different configuration, not a stripped-down separate product.
3. **Zero mandatory hardware.** The whole platform has to work from a single smartphone with nothing else purchased. Printers, kiosks, card readers, and NFC tags are upgrades, never requirements.
4. **Offline-first.** Order taking, billing, and cash payment work with no internet connection at all. Sync catches up automatically once connectivity returns.
5. **Branded, not marketplace.** Every merchant's online ordering lives on their own name and their own domain. Shopmaster is infrastructure the customer never sees, not another app competing for their attention.
6. **Local by design.** Currency, language (Nepali included from day one, not added later), tax rules, and local payment rails are core configuration, not a fork maintained for one market.

## 4. Target Users & Personas

| Persona | Team size | Device reality | What they actually need |
|---|---|---|---|
| **The tea stall** (Attariya-style, Nepal) | 1 owner-operator | One Android phone, patchy mobile data | A fast running total and a way to take cash correctly — nothing else, at least at first |
| **The neighbourhood café** | 2–8 staff | One tablet, maybe a printer | Table QR ordering, a simple ticket to the kitchen, a daily sales number they can trust |
| **The food truck** | 1–3 staff, mobile | Single phone or tablet, has to survive dead zones and no fixed power | Fully offline order-and-cash flow, tap-to-pay on the phone itself, nothing that depends on a fixed connection |
| **The bar** | 3–15 staff | Tablet(s), card readers | Running tabs, split-by-round, fast re-orders for regulars |
| **The full-service restaurant** | 10–50 staff | PC terminals, kitchen display, printers | Table management, ticket routing by station, split bills, staff roles, real inventory |
| **The multi-location chain / QSR** | 50+ staff, several sites | Mixed fleet of PCs and tablets | Central menu push, consolidated reporting across branches, franchise-level controls |

The product has to be honest about which of these it's ready to serve at each phase — see Section 16. Trying to be all six personas equally well on day one is how this kind of platform usually collapses under its own scope.

## 5. Goals & Success Metrics

- **Time to first sale.** A new tea-stall merchant goes from signup to taking their first QR order in under 15 minutes, with zero hardware purchased.
- **Device floor.** Full core POS functionality on a three-year-old Android device with 2GB of RAM and an unreliable connection — this is a hard target, not an aspiration, because it's the difference between actually reaching the smallest merchants and just claiming to.
- **Channel parity.** An item marked out of stock on the POS disappears from kiosk, QR, and online ordering within seconds. One source of truth, not three menus that drift apart.
- **Branded-ordering adoption.** Share of merchants who activate their own branded online ordering link within 30 days of signup.
- **Offline resilience.** 100% of core order-and-cash-payment flows complete with zero connectivity, and sync completes with no data loss once the connection comes back.
- **Commission independence.** Online ordering costs the merchant $0 or a flat fee — explicitly positioned against 20–30% marketplace commissions, and this is the number to track against competitors, not a rounding error.

## 6. Scope

**In scope for v1 (MVP)**
- Core order engine and staff POS (Android, iOS, and browser), single location.
- QR code table/menu ordering, pay-at-table or pay-at-counter.
- Branded online ordering on a Shopmaster-hosted subdomain, pickup mandatory, delivery toggle optional.
- Cash and card payment capture, tap-to-pay on the merchant's own phone where the local payment processor supports it.
- Menu and modifier management, English and Nepali language packs.
- Offline order-taking and cash payment, with automatic sync.
- Basic reporting: daily sales, top items, payment mix.

**Out of scope for v1 — deliberately deferred, not forgotten**
- Self-service kiosk hardware and locked-mode software (Phase 2).
- NFC table tags (Phase 2 — ships on the same backend as QR, so this is mostly a hardware and admin-UI addition, not new order logic).
- Multi-location and franchise console (Phase 3).
- Inventory and recipe-level stock deduction (Phase 2).
- Loyalty, CRM, and marketing messaging (Phase 2/3).
- Third-party delivery-fleet dispatch integration (evaluate in Phase 3, once there's real delivery volume to justify it).

## 7. Architecture Overview (conceptual)

```
CHANNELS (all customer- or staff-facing entry points)
  Staff POS  |  Kiosk  |  QR / NFC (customer's own phone, no app)  |  Branded Online Ordering
                                    |
                                    v
CORE COMMERCE ENGINE (one source of truth)
  Order state  |  Menu / catalog  |  Pricing & tax  |  Table / tab state
                                    |
                          (local-first cache + sync)
                                    |
                                    v
SHARED SERVICES
  Payments abstraction  |  Inventory  |  Staff & roles  |  CRM / loyalty  |  Reporting
                                    |
                                    v
BACK-OFFICE ADMIN CONSOLE (web)
  The one place a business — or a chain of them — configures everything above.
```

The reason this diagram matters more than it looks like it should: if kiosk, QR, and online ordering are separate systems that happen to sync to POS, channel parity (Section 5) becomes a promise you can't actually keep. They need to be views onto the same order engine, not separate engines that agree with each other most of the time.

## 8. Core Modules — Detailed Requirements

Each requirement is tagged with an ID (`MODULE-##`) so it can be lifted straight into engineering tickets without renumbering later.

### 8.1 Point of Sale — `POS`

- **POS-01** Order entry by category or search, with modifiers, combos, and free-text notes (e.g., "no onion").
- **POS-02** Order routing to the kitchen as a printed ticket and/or a kitchen display screen, routed by category — drinks to the bar printer, food to the kitchen printer, for example.
- **POS-03** Table management for dine-in: open, merge, transfer, and close tables. Running tabs for bar service, closed out on demand rather than per-round.
- **POS-04** Split bill by item, by seat, or evenly N ways; split payment across multiple tenders within one bill.
- **POS-05** Discounts and comps requiring manager PIN approval, with a full audit trail.
- **POS-06** Multi-tender payment capture in a single transaction — part cash, part card, for instance.
- **POS-07** Shift open/close with cash-drawer reconciliation: expected cash versus counted cash, with a variance report.
- **POS-08** Staff PIN or biometric login. Every action is attributable to a specific staff member.
- **POS-09** Fully functional offline: order entry, kitchen ticket printing, cash payment, and receipt issue, with automatic sync on reconnect (see `SYNC`).
- **POS-10** Configurable tax rule per line item — VAT-inclusive pricing for Nepal, GST-exclusive pricing for Australia — driven by the business's own tax registration status.
- **POS-11** Void and refund flow with mandatory reason codes and manager approval, fully audited.
- **POS-12** A "quick mode" configuration for single-operator businesses that collapses all of the above to three actions: add item, show total, take payment. Everything else is hidden, not deleted — this is the tea-stall default and the single most important line item in this entire module.

### 8.2 Self-Service Kiosk — `KIOSK`

- **KIOSK-01** The same core app running in a locked kiosk mode on any Android tablet, iPad, or Windows touchscreen. Not a separate product with its own codebase.
- **KIOSK-02** Guided ordering flow with large touch targets, item imagery, and upsell or combo prompts at checkout.
- **KIOSK-03** Idle/attract screen when there's no order in progress.
- **KIOSK-04** Integrated card/tap payment at the kiosk where the hardware supports it; falls back to "pay at counter" where it doesn't, rather than blocking the order.
- **KIOSK-05** Order-ready flow (number call or buzzer-style) feeding the same kitchen display queue as POS and QR orders — no separate queue to manage.
- **KIOSK-06** Basic accessibility: adjustable text size, high-contrast mode.

### 8.3 QR Code Table & Menu Ordering — `QR`

- **QR-01** A unique QR code per table (or per counter, for counter-service formats), generated and printable straight from the admin console. No special hardware.
- **QR-02** Scanning opens a mobile web page — no app download — branded to the merchant.
- **QR-03** Configurable per merchant: order-and-pay-at-table, or order-now-pay-at-counter.
- **QR-04** "Call waiter" and "request bill" buttons on the table page itself.
- **QR-05** Multi-diner mode: several phones scanning the same table code can add to one shared order, which can then be split at close (see POS-04).
- **QR-06** Orders placed via QR land on POS and the kitchen display identically to staff-entered orders, tagged with the table number.

### 8.4 NFC Table Ordering — `NFC`

- **NFC-01** Passive NFC tags — no power source, no reader hardware required — fixed to tables. Tapping with any NFC-capable phone opens the same ordering page as that table's QR code. Same backend, alternate way in.
- **NFC-02** Tags are provisioned and mapped to tables from the same admin screen used for QR codes (see ADMIN-01).
- **NFC-03** Ordering-NFC and payment-NFC (tap-to-pay, see PAY-02) are kept clearly distinct in both the UI and the documentation. They're two different taps at two different moments, and conflating them in the interface is a real way to confuse a customer mid-order.

### 8.5 Branded Online Ordering — `WEB`

- **WEB-01** Every merchant gets an own-branded ordering page — their logo, their colors, their name — on a Shopmaster subdomain at signup (e.g., `merchant.shopmaster.app`), with a custom domain (`order.merchantname.com`) available at higher tiers.
- **WEB-02** Pickup and delivery toggle, with delivery radius and fee rules configurable per merchant. Delivery is fulfilled by the merchant's own riders in v1; third-party fleet dispatch is a Phase 3 evaluation, not a v1 commitment.
- **WEB-03** Scheduled ordering — order now for a pickup or delivery time later.
- **WEB-04** Same menu, pricing, and stock-availability engine as POS, kiosk, and QR. There is no separate online menu to maintain by hand.
- **WEB-05** Guest checkout by default, with optional account creation to unlock order history and loyalty (see `CRM`).
- **WEB-06** No commission model. Shopmaster charges a subscription and/or a flat payment-processing fee — never a per-order percentage — and this is stated explicitly in merchant-facing marketing against marketplace aggregators, not just buried in a pricing page.

### 8.6 Menu & Catalog Management — `MENU`

- **MENU-01** Central menu builder: items, categories, modifiers, and combo deals, with per-channel pricing where needed (a delivery upcharge, for example).
- **MENU-02** Multi-language item names and descriptions — Nepali and English at minimum, built to extend to other languages without a rewrite.
- **MENU-03** Time- and day-based availability: a breakfast menu, happy-hour pricing.
- **MENU-04** One-tap "86" (mark out of stock) that propagates instantly across POS, kiosk, QR, and online ordering.
- **MENU-05** Photo support per item, with sensible placeholder defaults for merchants without professional photography — most tea stalls will never take a product photo, and the menu still needs to look complete.

### 8.7 Inventory & Stock — `INV` (Phase 2, opt-in)

- **INV-01** Recipe-level ingredient linkage so stock depletes automatically as items sell. Opt-in — a tea stall may never touch this module, and it shouldn't clutter their view if they don't.
- **INV-02** Low-stock alerts and reorder points.
- **INV-03** Supplier and purchase-order tracking.
- **INV-04** Wastage and spoilage logging with reason codes.

### 8.8 Payments — `PAY`

- **PAY-01** Cash as a first-class, always-available payment method — not a legacy fallback. This is what makes the smallest merchants and offline mode both work at all.
- **PAY-02** Tap-to-pay on the merchant's own phone (native Android/iOS contactless acceptance) where the local payment processor and card network support it, so no card reader has to be purchased to accept contactless. This should be confirmed market-by-market before being promised — see PAY-04 note on Nepal.
- **PAY-03** External Bluetooth card-reader support for merchants who want a dedicated terminal feel at higher volume.
- **PAY-04** Local payment-rail integration by market, sitting behind one internal payments interface so a new rail is a new adapter, not a new payment system. Illustrative examples: Nepali wallets and QR payment switches (eSewa, Khalti, Fonepay-style rails) and Australian card/bank rails. Card-present tap-to-pay infrastructure is more mature in Australia than in Nepal today, so PAY-02 should not be assumed available in the Nepal market at launch — confirm with a processor before committing it to Nepali merchants.
- **PAY-05** Split payment across tenders within a single bill (ties to POS-04/POS-06).
- **PAY-06** Tipping prompts, on or off by default and configurable by percentage or fixed amount, tuned to local norm rather than one global default.
- **PAY-07** No raw card data ever touches Shopmaster servers or devices. Everything is tokenized through PCI-DSS-compliant processors only.

### 8.9 Staff Management & Roles — `STAFF`

- **STAFF-01** Role-based permissions (owner, manager, cashier, waiter, kitchen) gating discounts, voids, reporting access, and settings.
- **STAFF-02** Shift scheduling and timesheets tied to PIN clock-in/out.
- **STAFF-03** Tip pooling and distribution rules where relevant — bars and table-service restaurants, mainly.

### 8.10 CRM & Loyalty — `CRM` (Phase 2/3)

- **CRM-01** A lightweight customer profile built from online-ordering accounts and repeat QR or phone-number activity — opt-in only.
- **CRM-02** Points or stamp-card-style loyalty, redeemable across POS, QR, and online ordering.
- **CRM-03** SMS and WhatsApp-based marketing and order-ready notifications, chosen deliberately over push-notification-only because reach through push alone is weak in several of the target markets.

### 8.11 Reporting & Analytics — `RPT`

- **RPT-01** Daily, weekly, and custom-range sales dashboard: revenue, item mix, payment mix, peak hours.
- **RPT-02** Exportable reports (CSV/PDF) for handoff to an accountant or bookkeeper.
- **RPT-03** Multi-location roll-up for chain owners (Phase 3), with per-branch drill-down.
- **RPT-04** Reports generate correctly for a day that included offline periods — queued locally, reconciled on sync, not silently dropped.

### 8.12 Multi-Location & Franchise — `MULTI` (Phase 3)

- **MULTI-01** Push a central menu to all branches, with optional per-branch price and availability overrides.
- **MULTI-02** Consolidated financial reporting across locations, role-gated — a branch manager sees their branch, an owner sees everything.
- **MULTI-03** Franchise-specific royalty and fee calculation.

### 8.13 Hardware & Device Flexibility — `HW`

- **HW-01** Installable as a Progressive Web App from any modern browser. A food truck can start from a bookmark on the owner's own phone — no app store, no install friction.
- **HW-02** A native Android app targeting low-spec devices (Android 8+, 2GB RAM target), because Android dominates the budget-device end of the markets this product is built for.
- **HW-03** A native iOS app for merchants standardized on Apple hardware.
- **HW-04** A desktop/browser POS mode with keyboard-shortcut support for high-throughput counters that want speed over touch.
- **HW-05** Optional peripheral support: Bluetooth or LAN thermal printers (58mm/80mm) for receipts and kitchen tickets, cash drawers, barcode scanners, external card readers.
- **HW-06** The minimum viable hardware to fully operate Shopmaster is one smartphone. Every other device on this list is an upgrade layered on the same core app, never a prerequisite.

### 8.14 Offline-First & Sync — `SYNC`

- **SYNC-01** Order-taking, bill calculation, cash payment capture, and kitchen ticket printing all function with zero connectivity.
- **SYNC-02** Local-first storage on-device is the source of truth for an active session, with a background service reconciling to the cloud once a connection exists.
- **SYNC-03** Card and digital payments that require live authorization are clearly flagged as unavailable offline, with an automatic prompt to fall back to cash. This is a real technical limit, not a UX choice — offline card processing isn't something to promise and then quietly not deliver.
- **SYNC-04** Deterministic conflict resolution for edits made on multiple devices while offline — the same table edited from two tablets, for example. This needs an actual architecture decision before Phase 1 ships: candidates are an operation-log merge or last-write-wins with a visible audit trail. Don't leave this until it's a production incident.
- **SYNC-05** An always-visible sync status indicator, so staff are never left wondering whether a sale actually went through.

### 8.15 Back-Office Admin Console — `ADMIN`

- **ADMIN-01** A web-based console for menu, staff, pricing, tax, hours, and QR/NFC generation — the single configuration surface for everything above it.
- **ADMIN-02** A guided setup wizard, tuned by business type at signup (tea stall, café, bar, restaurant, truck, takeaway), that pre-selects a sensible feature set. Changeable later — this is a starting point, not a lock-in.

### 8.16 Localization & Compliance — `LOC`

- **LOC-01** Multi-currency pricing and display — NPR and AUD at minimum — and a multi-language UI covering English and Nepali.
- **LOC-02** A configurable tax engine per jurisdiction (Nepal VAT, Australian GST) at the line-item level.
- **LOC-03** Nepal electronic billing (IRD / CBMS). Nepal's Inland Revenue Department requires IRD-approved billing software for VAT-registered businesses above certain turnover thresholds, reporting in real time to the Central Billing Monitoring System. Publicly reported thresholds put the general requirement at roughly NPR 10 crore in annual transactions, with a lower threshold — roughly NPR 5 crore — specifically for hotels, restaurants, and canteens, and real-time CBMS synchronization required above roughly NPR 25 crore. These figures should be confirmed directly with a Nepal-licensed tax advisor before being relied on; the mandate has also been expanding to more businesses over time under Nepal's Digital Nepal Framework, so what's out of scope today may not stay out of scope. Software has to be IRD-tested and formally approved before it can issue invoices, has to display PAN/VAT and structured tax fields, and has to keep a full audit-trail log. There's a real architectural implication buried in the requirement, too: reported guidance calls for the billing system's server to sit inside Nepal, or for a documented third-party hosting agreement, with foreign-hosted multi-tenant providers required to keep a separate in-country audit-log server. That needs to be scoped properly if and when Shopmaster pursues IRD approval — it's not a checkbox.
- **LOC-04** Practically, the NPR 5 crore hospitality threshold sits well above single-location tea-stall or café turnover, so Starter- and most Growth-tier Nepali merchants are very unlikely to be in scope initially. Treat this as a Phase 2/3 compliance item tied to larger restaurant and hotel clients, not an MVP blocker — but don't let that turn into forgetting about it once Shopmaster starts signing bigger Nepali accounts.
- **LOC-05** Receipt and invoice formatting meets local requirements: ABN display for Australia, PAN/VAT registration display for Nepal.
- **LOC-06** Everything in this module is directional, drawn from public compliance guidance rather than primary legal review, and needs sign-off from qualified local counsel before implementation — the same posture as the rest of the regulatory work in your other products: a draft to build from, not a legal opinion.

## 9. Tiering & Packaging (illustrative)

| Tier | Who it's for | Included | Price shape |
|---|---|---|---|
| **Starter** | Tea stall, single food truck | POS in quick mode, QR ordering, cash + tap-to-pay-on-phone where supported, one device | Free or near-free flat fee, no monthly minimum |
| **Growth** | Café, bar, single restaurant | Everything in Starter, plus kiosk mode, NFC, branded online ordering, inventory, multiple devices, kitchen display | Flat monthly fee, optional payment-processing fee |
| **Enterprise** | Multi-location chains, franchises | Everything in Growth, plus the multi-location console, franchise tooling, API access, dedicated support, an SLA | Custom, priced per location |

The tiering exists to protect Principle 2 (progressive complexity), not just to segment price. If a feature can't be cleanly hidden from the Starter tier, that's a sign it needs more configuration work before it ships, not a reason to turn it on for everyone by default.

## 10. Illustrative User Journeys

**The tea stall owner, morning to close.** Opens the app on the same phone she's had for two years. Quick mode: tap the item, tap again for a second cup, total shows, customer pays cash or taps their card on her phone. No login screen beyond her own PIN, no printer, no setup beyond the ten minutes it took to add her six menu items when she signed up.

**A customer at a mid-size restaurant table.** Scans the table QR, browses the branded menu on their own phone, adds two items, taps "call waiter" to ask about a modification, orders, and the ticket appears on the kitchen display station tagged for "Table 12" — indistinguishable, from the kitchen's side, from an order a waiter typed in by hand.

**The food truck at a weekend market.** No fixed power, patchy signal. Orders get taken and paid for in cash entirely offline through the day; card taps queue where the network allows a live authorization and otherwise prompt cash. At close, the truck drives back into signal range and the day's sales sync and reconcile automatically, no manual export required.

**A restaurant manager at close.** Runs shift close: counted cash against expected cash, a variance flagged automatically if there's a gap, the day's report generated and exported to the accountant — including whatever portion of the day happened during a mid-afternoon internet outage, because RPT-04 means that data was never actually lost, just queued.

## 11. Non-Functional Requirements

- **Performance.** Item add-to-order responds in well under a second; a first-time kiosk user can complete checkout in under 90 seconds.
- **Reliability.** The offline core (SYNC-01) has zero dependency on any external service — that's the actual test of whether "offline-first" is real or just a slide.
- **Security.** PCI-DSS-aligned payment handling (PAY-07), role-based access control (STAFF-01), and a full audit trail on every discount, void, and refund (POS-05/POS-11).
- **Data privacy.** Customer data under `CRM` is opt-in only and deletable on request, aligned to the applicable privacy law in each operating market — the Australian Privacy Act, and Nepal's data-protection framework as it continues to develop. Needs legal review, not assumed here.
- **Scalability.** The same codebase has to support a single-device tea stall and a multi-terminal, multi-location enterprise without forking. If a scaling decision forces a fork, that's an architecture problem to solve, not a shortcut to take.
- **Accessibility.** Kiosk and QR ordering pages meet basic WCAG-AA contrast and text-size practice.

## 12. Technical Architecture (high-level)

- **Client layer.** A cross-platform app (React Native or a PWA-first approach are both reasonable starting points) covering POS, kiosk, QR web, and admin from as close to one codebase as practical — this is what keeps "one engine, many faces" a real architectural property instead of a marketing description.
- **Local data layer.** An on-device embedded database as the source of truth during an active session, paired with a sync/queue service that reconciles to the backend (see `SYNC`).
- **Core API.** Order, menu, pricing/tax, and table/tab state, built channel-agnostic so POS, kiosk, QR/NFC, and online ordering are all just different clients calling the same API — not four APIs that need to be kept in agreement by hand.
- **Payments abstraction layer.** One internal interface with pluggable processor adapters per market and rail (PAY-04). Adding a new local payment rail should be a new adapter, not a new payment system bolted alongside the old one.
- **Admin and reporting.** A standard web app against the same core API — no separate reporting database to keep in sync.
- **Hosting and scale.** A multi-tenant cloud backend. Worth a direct conversation rather than an assumption here: given the existing fintech infrastructure and compliance tooling already built for Fintex Australia, some of that DevOps and compliance groundwork may be reusable for Shopmaster, or it may be cleaner to keep Shopmaster as its own technical estate entirely — that's a real decision, not a default either way (see Section 18).

## 13. Competitive Landscape (directional, non-exhaustive)

- **Global POS and ordering platforms** — Square, Toast, Lightspeed. Strong on POS and payments, but priced and designed for a mature-market restaurant. Not built for a single-operator tea stall, and not offline-first for markets where connectivity can't be assumed.
- **South Asia-focused restaurant tech** — platforms like Petpooja and UrbanPiper-style aggregation layers. Strong on local restaurant operations, less focused on the true micro-merchant end (the single-person stall) or on giving that merchant their own branded consumer storefront.
- **Delivery marketplaces** — Zomato, UberEats, Foodpanda. These own the branded online-ordering relationship today and charge commission for it. WEB-06 is a direct point of difference here, not a feature to match.
- **The actual gap.** Nothing currently on the market spans one phone and one owner-operator all the way through to a multi-location enterprise on a single codebase, with real offline-first design and Nepal-and-Australia-aware localization built in rather than retrofitted. That's the position worth defending, and it's also the hardest one to build — the temptation will be to chase feature parity with the enterprise players before the micro-merchant end is actually solid, and that's the wrong order to build in given this product's stated reason for existing.

## 14. Monetization Strategy

- Subscription tiers (Section 9) as the primary revenue line.
- An optional flat or low payment-processing fee for merchants using Shopmaster's built-in payment rails, priced well below marketplace commission levels — this is the number that has to hold up under scrutiny, since it's the whole premise of WEB-06.
- Hardware bundles — printer, cash drawer, kiosk stand — as an optional add-on sale or rental for merchants who want dedicated hardware rather than running on a bare phone. Never mandatory, never bundled into the base subscription price.

## 15. Go-to-Market Notes

Nepal and Australia are the natural first markets: Nepal covers the tea-stall-through-restaurant range described throughout this document and can lean on existing Kathmandu engineering relationships, and Australia covers the café/restaurant/bar market from a Sydney base. Worth flagging directly: the recent registration research for a software development entity in Kailali district could be a natural local development and support base for Shopmaster specifically, particularly for Nepali-market merchant support and lower-cost engineering capacity — this is worth a real decision rather than defaulting into it, but it's a strong enough fit that it belongs in this document.

A "free forever" Starter tier is worth treating as the primary acquisition channel for the smallest merchants, monetizing as they grow into Growth and Enterprise rather than trying to charge the tea stall from day one.

## 16. Roadmap (phased)

| Phase | Scope | Goal |
|---|---|---|
| **Phase 1 — MVP** | POS (quick + full mode), QR ordering, branded online ordering (pickup), cash and tap-to-pay, offline core | Prove the "one phone, zero hardware" experience end to end, from tea stall through café |
| **Phase 2** | Self-service kiosk, NFC tags, inventory, loyalty/CRM, delivery | Cover full-service restaurant and bar needs properly |
| **Phase 3** | Multi-location/franchise console, advanced analytics, API and marketplace integrations | Cover chains and enterprise accounts |

## 17. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Offline sync conflicts corrupt an order or a bill | Settle the conflict-resolution design (SYNC-04) before Phase 1 ships, tested deliberately — not something to patch after the first incident |
| Local payment-rail coverage gaps, especially in Nepal, delay launch | Cash and tap-to-pay-on-phone (PAY-01/02) are always-available fallbacks, so payment-rail integration is additive to launch, not blocking it |
| Feature creep erodes the "three-button tea stall" promise | Every new feature ships behind the tiering/config system (Section 9) and is off by default for Starter — this has to be a rule the team actually enforces, not an intention |
| Competing head-on against entrenched, well-funded POS players | Differentiate on the underserved micro-merchant end plus offline-first plus no-commission branded ordering, rather than trying to match the enterprise players feature-for-feature first |
| Hardware and peripheral fragmentation across markets | Keep every peripheral optional; certify a short list of known-good Bluetooth printers and readers per market rather than promising universal compatibility that can't actually be tested |
| Nepal e-billing/CBMS requirement is under-scoped for a large Nepali account | Track LOC-03/LOC-04 as a real Phase 2/3 gate before onboarding any Nepali merchant approaching the hospitality turnover threshold, not a footnote discovered mid-sales-cycle |

## 18. Open Questions

- Is Shopmaster a standalone venture, or built under/alongside Fintex Australia? This affects shared infrastructure, compliance tooling, and branding, and it's worth deciding early rather than drifting into an answer.
- Does the recent Kailali software-entity registration research represent an actual planned development base for Shopmaster, or is that a separate initiative?
- Primary launch market: Nepal-first, Australia-first, or genuinely simultaneous? The MVP scope in Section 6 works for either, but go-to-market sequencing (Section 15) doesn't.
- Own delivery-fleet routing, or staying pickup/dine-in-only at launch and leaving delivery logistics entirely to the merchant?
- What's the actual current Nepal CBMS threshold and process, confirmed with a licensed advisor rather than the public compliance-blog sources used in LOC-03 — needed before any commitment is made to a Nepali merchant near that turnover level.

## 19. Glossary

- **KOT** — Kitchen Order Ticket, the printed or displayed instruction sent from POS to the kitchen.
- **KDS** — Kitchen Display System, a screen-based alternative to a printed KOT.
- **PWA** — Progressive Web App, an installable app served from a browser without an app-store download.
- **QSR** — Quick Service Restaurant (takeaway/fast-food format).
- **PCI-DSS** — Payment Card Industry Data Security Standard, the compliance standard for handling card data.
- **CBMS** — Central Billing Monitoring System, Nepal's IRD-operated real-time invoice monitoring system.
- **86 / 86'd** — Restaurant-industry shorthand for marking an item unavailable/out of stock.
