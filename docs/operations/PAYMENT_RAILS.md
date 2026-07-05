# ShopMaster — Payment Rail Go-Live Guide

The payments layer (`packages/core/src/payments/index.ts`) is a clean abstraction (BE-07): one
interface — `authorize` / `capture` / `refund` / `getStatus` — with one adapter per rail. **Cash is
real.** Every other rail today is a clearly-labelled **mock** (`mock: true`, no network, no real
money). Going live is implementing one adapter body per rail — this file is the checklist.

The one non-negotiable, from `Shopmaster_Payment_Integration.md` §1: **ShopMaster never holds
merchant funds.** Every rail settles directly into the *merchant's own* account. And **no crypto
rail is ever offered to an NPR (Nepal) merchant** — enforced structurally by `railsForCurrency()`.

## What every live rail needs

1. A **merchant account** on the rail (the merchant's, not ShopMaster's).
2. **Credentials** stored in the secrets manager (PLAT-14), never in source or committed env.
3. The adapter's `authorize`/`capture` bodies swapped from the mock to the real API call.
4. Confirmation the funds land in the merchant's account, and the settlement string in the adapter
   updated so merchant reporting (RPT-01) shows the right timing.

## Per-rail checklist

| Rail | Market | Merchant registers with | Flow | Credentials to inject | Settlement | Priority (PAYINT §7) |
|---|---|---|---|---|---|---|
| **Cash** | both | — | POS tender, change calc | none | instant | ✅ live |
| **Tyro EFTPOS** | AU | Tyro (via merchant) | POS → paired terminal, tap/insert, confirm back | terminal/integration key, MID | same-day | 2 |
| **NepalQR / Fonepay** | NP | merchant's bank or Fonepay | dynamic QR per bill, customer scans any bank/wallet app | merchant ID | T+1 | 3 |
| **Tyro eCommerce / Stripe** | AU (online) | Tyro or Stripe | hosted/Elements checkout | API key / publishable key | same-day / per terms | 4 |
| **eSewa** | NP (online) | eSewa merchant | redirect + token | merchant code, secret | wallet → bank | 5 |
| **Khalti** | NP (online) | Khalti merchant | redirect + token | public/secret key | wallet → bank | 5 |

## How to wire one (example: Tyro)

1. In `packages/core/src/payments/index.ts`, replace the `mockRail("TYRO", …)` factory result with a
   real adapter whose `authorize`/`capture` call Tyro's integration API using credentials from env
   (e.g. `process.env.TYRO_INTEGRATION_KEY`, `TYRO_MID`).
2. Keep the return shape (`PaymentResult`) identical — the order service and UI need no change.
3. Set `mock: false`. Update `settlement` to Tyro's real timing.
4. Add the env vars to the secrets manager and to `apps/api/.env.example` (as placeholders only).
5. Test end-to-end in the rail's **sandbox** before pointing at production credentials.

## Sequencing (matches Payment-Integration §8)

- **Phase 1 (with the MVP):** Cash (both markets) — done. Then Tyro EFTPOS (AU in-person) and
  NepalQR/Fonepay (NP in-person).
- **Alongside online ordering going live:** Tyro eCommerce or Stripe (AU), eSewa + Khalti (NP).
- **On demand later:** IME Pay, ConnectIPS, PayID/PayTo, FoneTAG.
- **Web3:** deliberately unscheduled and **never for Nepal** (illegal — Payment-Integration §6.1).

## Guardrail

`assertProdConfig()` (SECURITY.md / PLAT-14) already refuses to boot production with a default JWT
secret. Before enabling any non-cash rail in production, confirm its credentials are present and the
adapter's `mock` flag is `false` — a mock adapter in production would accept "payments" that never
actually charge anyone.
