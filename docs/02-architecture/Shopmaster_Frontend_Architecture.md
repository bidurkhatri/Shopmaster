# Shopmaster — Frontend Architecture

| | |
|---|---|
| **Product** | Shopmaster |
| **Document type** | Sub-system design — Frontend |
| **Version** | 0.1 — Draft for review |
| **Date** | 2 July 2026 |
| **Prepared by** | Bidur |
| **Builds on** | PRD Section 8.13 (`HW`), Section 3 Principle 1–3 |

## 1. Scope

How "one engine, many faces" and "zero mandatory hardware" actually get built as client software, not just promised in the PRD. IDs here: `FE-##`.

## 2. Two Codebases, Not One — and Not Four

The instinct might be one universal codebase for everything. That's wrong in a specific way worth stating up front: staff-facing surfaces and customer-facing surfaces have genuinely different constraints, and collapsing them into one bundle would make both worse.

- **FE-01 — Staff app (POS, Kiosk, Admin console): one React Native codebase**, using React Native Web to also produce the desktop/browser POS mode (HW-04) from the same source. This is what makes HW-01 through HW-06 real rather than four separate builds pretending to be one product — a single codebase compiles to Android, iOS, and a browser bundle, and "POS mode" versus "Kiosk mode" versus "Admin console" are configuration on top of that, not separate apps (see Section 4).
- **FE-02 — Customer-facing ordering (QR/NFC page, branded online ordering): a separate, lighter web app**, plain React (or Next.js) rather than the React Native bundle. Three reasons, not one: a customer loads this fresh in a mobile browser for a single session and needs a fast first paint, not a heavy app-shell download; it doesn't need offline capability the way staff devices do — if the venue has no internet, a customer's phone can't reach a hosted ordering page regardless of how the frontend is built, so there's nothing to gain from carrying the same offline machinery; and keeping it a separate codebase keeps the customer-facing attack surface genuinely separate from the staff/admin one, which is the same reasoning behind keeping their Auth0 connections apart (AUTH-06).

Both share the design system (Section 6) so they still look and feel like one product to anyone who sees both sides of an order.

## 3. Local-First State — the Outbox Pattern

- **FE-03** The UI reads and writes against a local embedded database first, always — an on-device SQLite store (via a cross-platform binding), not the network. Every user-visible action (add item, take payment, mark ready) completes instantly against local state; nothing waits on a round-trip.
- **FE-04** Writes that need to reach the backend go into a local **outbox table** — an append-only queue of pending operations, each with an idempotency key. A background sync worker drains the outbox whenever connectivity exists, and a stalled or empty network connection simply means the outbox grows instead of the app breaking. This is the client-side half of the sync engine described in Backend Architecture Section 5; the outbox *is* the "batch of timestamped, device-signed events" that shows up on the backend.
- **FE-05** This is a deliberate choice over reaching for one of the newer local-first sync libraries/frameworks — that ecosystem is still maturing, and a plain, well-understood outbox pattern is easier for a small team to fully own, debug at 2am, and reason about than a framework whose sync internals are someone else's black box.

## 4. Progressive Complexity as Configuration, Not Compile-Time Variants

- **FE-06** POS-12's "quick mode" is a runtime capability manifest fetched at login, not a separate app build. A merchant's tier and business type (set during ADMIN-02's setup wizard) resolve to a feature/navigation set on the server side; the client renders whatever that manifest allows and hides the rest. The single installed app can be a three-button tea-stall POS today and, without a new download or app-store submission, become a full restaurant POS the moment that merchant upgrades tiers.
- **FE-07** This has a real implication for how screens get built: every screen in the staff app needs to degrade gracefully to "not present" rather than assuming its dependencies (inventory, multi-location, loyalty) exist. A component that silently assumes Inventory is always available will break the Starter-tier experience the day someone forgets this rule.

## 5. Kiosk Mode

- **FE-08** True lockdown needs OS-level cooperation, not just an in-app "kiosk view" — Android Enterprise's kiosk/screen-pinning mode and iOS Guided Access (or supervised-device configuration via Apple Configurator for merchant-owned hardware) are what actually prevent a customer from backing out to the home screen. The app provides the kiosk UI (KIOSK-01 through KIOSK-06); the OS provides the fence around it. Worth setting expectations early that a merchant using a personal, unsupervised tablet for kiosk mode gets a softer lock (in-app only) than one using a supervised, merchant-owned device.

## 6. Design System

- **FE-09** One shared component library — buttons, item cards, modals, the menu-browsing grid — consumed by the React Native staff app and mirrored (same tokens, same visual language, separately implemented) in the customer-facing React app from FE-02. Built with theming as a first-class capability from day one, not retrofitted, since WEB-01's branded-storefront requirement means every merchant's colors and logo have to flow through this system cleanly.
- **FE-10** Devanagari (Nepali script) rendering gets tested explicitly, not assumed — font loading and line-height/rendering behavior for Devanagari differs from Latin script in ways that don't always show up until a real device is tested, and MENU-02/LOC-01 depend on this actually working, not just being technically "supported" by a font file that renders wrong on a budget Android device.

## 7. Sync Status & Offline UX

- **FE-11** SYNC-05's always-visible sync indicator is a persistent, small UI element (not a modal or a settings-page fact) showing outbox depth and last-successful-sync time, sourced from the backend's per-device sync-state endpoint (Backend Architecture BE-06).
- **FE-12** Card/digital payment unavailability while offline (SYNC-03) is a UI state, not an error — the payment screen detects connectivity and routes straight to a cash-focused flow rather than presenting a card option that's guaranteed to fail and then apologizing for it.

## 8. Performance Budget

- **FE-13** HW-02's 2GB RAM / Android 8+ target isn't a claim to test once — it needs an actual perf budget (bundle size ceiling, cold-start time target, frame-rate floor during order entry) checked against real low-end hardware in CI or at minimum before every release, not just tested on whatever phone is on a developer's desk.

## 9. Open Questions

- Does React Native Web genuinely get the desktop/browser POS mode (HW-04) to feel native enough for a high-throughput counter, or does that surface eventually want its own lighter web-specific build once real usage data exists?
- What's the actual local embedded-database choice and binding — this needs a short technical spike before commitment, not just a name picked in a planning document.
- Kiosk mode on unsupervised, merchant-owned tablets (the realistic case for most Starter/Growth merchants who don't buy dedicated kiosk hardware): how much of FE-08's soft-lock gap is acceptable for v1 versus something to solve properly before KIOSK ships in Phase 2?
