# ShopMaster — Hardware Compatibility

Closes **GAP-09**. "Certify a known-good printer and card-reader list per market" was a line in a
risk table (Platform Architecture / PRD §8.13), not an actual list — meaning **a merchant literally
cannot be told what to buy today.** This document is that starter list. It is framed, first and last,
by **HW-06: the minimum viable hardware to fully operate ShopMaster is one smartphone. Every other
device here is an upgrade layered on the same core app, never a prerequisite.**

> **This is a candidate list to certify, not a certified list yet.** GAP-09 asks for devices that are
> *certified* — and certification means someone physically paired the device, printed a real kitchen
> ticket, opened a real drawer, and took a real payment on it, per market. That hands-on testing has
> **not** happened yet. Every model below is a real, widely-available, well-supported candidate chosen
> to *start* that testing from — not a device ShopMaster has verified. Treat the "Status" column as
> the source of truth: `candidate` means buy-to-test, not buy-to-deploy. Keeping this honest is the
> same ethic as the rest of the repo — the risk table warned against "promising universal
> compatibility that can't actually be tested," so this list promises the opposite: a *short* list
> that *will* be tested.

---

## 1. The zero-hardware floor (HW-06) — read this before the tables

ShopMaster runs, fully, on **one phone in a browser** (PWA-first, HW-01/04). A one-person tea stall in
Attariya takes cash orders, runs a live total, and shows a QR code for a customer to order from —
**with nothing purchased beyond the phone already in their pocket.** Everything in §3–§6 below is an
*upgrade* a growing merchant chooses, in this rough order of who-needs-what:

- Most merchants never need a card reader in Nepal at all — the payment rails there are **QR-based**
  (§5.1), so the phone screen *is* the terminal.
- A printer is the first upgrade most sit-down venues want (kitchen tickets), not the first thing
  anyone must buy.
- Kiosk stands, cash drawers, and dedicated terminals are the high-volume tail, never the entry point.

The tables exist so a merchant who *does* want an upgrade has a short, safe answer — not so anyone is
ever told they need one.

---

## 2. Budget Android device floor (HW-02)

The hard target, not an aspiration (PRD §8): **full core POS functionality on a three-year-old
Android device with 2GB of RAM and an unreliable connection.** This is the difference between actually
reaching the smallest merchants and just claiming to — Android dominates the budget-device end of
both markets. The offline-first outbox (`DISASTER_RECOVERY.md` §1) is what makes the "unreliable
connection" half of that target real.

| Floor spec | Requirement |
|---|---|
| OS | **Android 8.0+** (HW-02) |
| RAM | **2 GB** target minimum |
| Age | Functions on a ~3-year-old device |
| Browser | Chrome/Chromium current or PWA install |
| Connectivity | Works offline; syncs on reconnect (SYNC-01..05) |

**Candidate devices that meet the floor** (buy-to-test — real budget models common in these markets):

| Device | Market fit | Status |
|---|---|---|
| Samsung Galaxy A0x / A1x series | Both — widely serviced | `candidate` |
| Xiaomi Redmi 9A / 10A / A-series | Nepal & Australia budget | `candidate` |
| Realme C-series | Nepal budget | `candidate` |
| Nokia budget (C-series) | Both | `candidate` |

The point is not the exact model — budget Android churns fast — it is that the **2GB / Android 8**
floor is validated on at least one real device per market before a merchant is told "your phone is
enough."

---

## 3. Thermal printers — 58mm & 80mm, Bluetooth (HW-05)

Optional peripheral support: Bluetooth or LAN thermal printers for receipts and kitchen tickets
(HW-05). **58mm** is the small receipt/ticket format common at stalls and cafés; **80mm** is the
standard kitchen-ticket and receipt width for sit-down venues. All Bluetooth candidates below are
chosen for pairing simplicity from a phone (no dedicated hub).

| Printer | Width | Interface | Market fit | Status |
|---|---|---|---|---|
| Epson TM-m30II | 80mm | Bluetooth / USB / LAN | Australia (strong local support) | `candidate` |
| Epson TM-P20 | 58mm | Bluetooth (mobile) | Both | `candidate` |
| Star Micronics TSP143 (mC-Print) | 80mm | Bluetooth / USB / LAN | Australia | `candidate` |
| Star mPOP | 80mm | Bluetooth | Both — see §4 (integrated drawer) | `candidate` |
| Xprinter XP-58 / XP-P323B | 58mm | Bluetooth | Nepal & South Asia (low cost, ubiquitous) | `candidate` |
| Rongta RPP02/RPP300 | 58/80mm | Bluetooth | Nepal budget | `candidate` |
| Munbyn ITPP series | 58/80mm | Bluetooth | Both budget | `candidate` |

Certification per model = pair from a floor-spec phone (§2), print a real kitchen ticket and a real
receipt, and confirm the layout, character set (including **Devanagari** for Nepali receipts,
FE-10), and the auto-cut behave. Devanagari rendering is the single most likely thing to fail on a
cheap printer and is a mandatory check for the Nepal-market models.

---

## 4. Cash drawers

The near-universal pattern: a cash drawer is **printer-driven** — it plugs into the receipt printer's
RJ11/RJ12 "kick" port and opens on a receipt/cash event. So the certified answer for most merchants is
"any standard printer-kick drawer that matches your certified printer," not a specific brand.

| Cash drawer | Pattern | Market fit | Status |
|---|---|---|---|
| Star mPOP (integrated printer + drawer) | All-in-one 80mm printer with built-in compact drawer | Both — cleanest single-purchase upgrade | `candidate` |
| Generic 13" / 16" RJ11/RJ12 kick drawer | Printer-driven, opens via the receipt printer | Both | `candidate` |

Certification = confirm the drawer opens reliably on a cash-payment event through the paired printer,
on the actual printer chosen. Note the honest constraint: a **pure-phone** merchant with no printer
has no printer to drive a drawer from — which is fine, because a pure-phone merchant is taking cash
into a physical till by hand, exactly the HW-06 floor. The drawer is an upgrade that arrives *with*
the printer, not before it.

---

## 5. Card readers — per market (the part that differs most)

This is where the two markets genuinely diverge, and where "zero mandatory hardware" is most
concretely true.

### 5.1 Nepal (NPR) — usually **no reader at all**
The Nepal rails are **QR-based**: `railsForCurrency("NPR")` → `CASH, FONEPAY, ESEWA, KHALTI`
(`packages/shared/src/constants.ts`). Fonepay/NepalQR and the wallets are settled by the **customer
scanning a dynamic QR displayed on the merchant's phone screen** — so **the phone is the terminal and
no card reader is purchased.** This is the strongest expression of HW-06 in the whole product: the
highest-friction hardware in the Australian market simply does not exist in the Nepali one.

| Nepal "reader" | Reality | Status |
|---|---|---|
| Merchant phone screen | Displays the dynamic Fonepay/eSewa/Khalti QR — no hardware bought | `candidate` (once rails go live; today the rails are **mock** — see `CODE_MAP.md`) |

### 5.2 Australia (AUD) — Tyro, plus tap-to-pay on the phone
`railsForCurrency("AUD")` → `CASH, TYRO`. Two upgrade paths, neither mandatory:

| Australia option | What it is | Requirement mapping | Status |
|---|---|---|---|
| **Tap-to-pay on the merchant's own phone** | Native Android/iOS contactless acceptance — **no reader purchased** | PAY-02 (confirm market-by-market before promising) | `candidate` |
| **Tyro EFTPOS terminal / Tyro Go** | Dedicated card terminal for higher volume / a "terminal feel" | PAY-03 (external reader), TYRO rail | `candidate` |

The Australian entry point is still zero-hardware — tap-to-pay on the merchant's existing phone
(PAY-02) — with a dedicated Tyro terminal as the volume upgrade (PAY-03), not a starting requirement.

> **Reader status is gated on live rails.** Every non-cash rail today is a **mock/sandbox adapter** —
> no network, no real money (`CODE_MAP.md`, `SECURITY.md` §1). Card-reader certification cannot
> complete until the corresponding live rail is wired in. Until then these rows are candidates for the
> *hardware* half only.

---

## 6. NFC tags (QR/NFC table ordering)

QR/NFC table ordering (QR-01..06) works from a **printed QR code** with zero tag hardware — a laminated
code on the table is the floor. **NTAG213/215** NFC stickers are an optional tap-to-order upgrade for
venues that want it; they encode the same `qrToken` the printed code carries. Optional, cheap, never
required.

| Tag | Use | Status |
|---|---|---|
| Printed/laminated QR | Table ordering, zero hardware | `candidate` (the floor) |
| NTAG213 / NTAG215 sticker | Optional tap-to-order | `candidate` |

---

## 7. How a model graduates from `candidate` to `certified`

The status column moves from `candidate` to `certified` only when, **on the actual target market and a
floor-spec device (§2)**, someone has:

1. paired/connected the device from a budget phone, offline-first behaviour intact;
2. exercised its real job — printed a real ticket *and* receipt (with Devanagari where relevant),
   opened a real drawer on a cash event, or taken a real payment on a **live** (non-mock) rail;
3. recorded the model, firmware, market, and result.

Until then, `candidate` means *buy one to test*, not *tell a merchant to buy it*. This list is the
starting point GAP-09 asked for — short, real, and honest about what has and has not yet been put
through a real device.
