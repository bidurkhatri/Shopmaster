# ShopMaster — API Contract

Closes **GAP-04**. The REST surface exposed by `apps/api` (Express modular monolith). Base URL:
`http://localhost:4000/api`. All bodies and responses are JSON. Auth is a Bearer JWT
(`Authorization: Bearer <token>`) carrying `organizationId`, `role`, `locationIds` (BE-10). Request
shapes are validated by the Zod schemas in `@shopmaster/shared`.

Money is always an integer in the currency's **minor units** (cents/paisa).

## Auth (two-tier — Auth-Flow)

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{ email, password }` | `AuthResponse` (Tier-1 owner/manager) |
| POST | `/auth/pin` | — | `{ staffId, pin }` | `AuthResponse` (Tier-2 offline staff switch) |
| POST | `/auth/pair` | — | `{ email, password, deviceName, locationId? }` | `AuthResponse` + `{ device }` |

`AuthResponse = { token, user: SessionUser, organization: OrganizationDTO, capabilities: Capabilities }`

## Public storefront / QR (unauthenticated, read-only)

| Method | Path | Returns |
|---|---|---|
| GET | `/orgs/:slug` | `OrganizationDTO` |
| GET | `/orgs/:slug/menu?locale=` | `MenuCategoryDTO[]` |
| GET | `/orgs/:slug/staff` | `{ id, name, role }[]` (for the PIN switcher) |
| GET | `/tables/:qrToken` | `{ table, location, organization, menu }` (QR/NFC entry) |

## Public customer ordering (unauthenticated, rate-limited — BE-13)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/public/orders` | `{ qrToken? , orgSlug?, fulfillment, customerName?, customerPhone?, deliveryAddress?, loyaltyOptIn? }` | `OrderDTO` |
| GET | `/public/orders/:id` | — | `OrderDTO` |
| POST | `/public/orders/:id/events` | `{ events: OrderEventInput[] }` | `{ order, inserted, duplicates, conflicts }` |
| POST | `/public/orders/:id/pay` | `{ rail, amountMinor, tenderedMinor? }` | `{ order, payment, result }` |

## Session context & capabilities (auth)

| Method | Path | Returns |
|---|---|---|
| GET | `/context` | `{ organization, capabilities, locations[] }` (locations include tax config + tables) |
| GET | `/capabilities` | `Capabilities` (FE-06) |

## Menu admin (auth — `menu.manage`)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/menu?locale=` | — | `MenuCategoryDTO[]` |
| POST | `/menu/categories` | `{ nameEn, nameNe?, sort? }` | category |
| POST | `/menu/items` | `{ categoryId, nameEn, nameNe?, priceMinor, station?, … }` | item |
| POST | `/menu/items/:id/availability` | `{ available }` | item (one-tap 86, MENU-04) |

## Inventory (auth — `menu.manage`, Growth+ — INV-01/02)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/inventory?locale=` | — | `InventoryReport` (per-item stock, low-stock flags, recent movements) |
| POST | `/inventory/set` | `{ menuItemId, stockLevel, reorderPoint? }` | `InventoryItem` (stock-take; auto-86/un-86) |
| POST | `/inventory/adjust` | `{ menuItemId, delta, reason? }` | `InventoryItem` (restock / write-off) |

Confirming an order auto-deducts sold quantities (idempotent per order, via the domain event bus);
hitting zero auto-86's the item across every channel, restocking above zero restores it.

## Loyalty / CRM (auth — `reports.view`, Growth+ — CRM-01/02)

| Method | Path | Returns |
|---|---|---|
| GET | `/customers` | `CustomerDTO[]` (opt-in rewards members, ranked by spend; visits/points derived) |
| GET | `/customers/:id` | `CustomerDetailDTO` (with recent order history; 404 cross-tenant — GAP-05) |

Profiles are created only on opt-in: the public order body accepts `loyaltyOptIn` and, when the
merchant's tier includes loyalty, links the order to a profile keyed by `customerPhone`.

## Shifts / cash reconciliation (auth, Growth+ — POS-07)

| Method | Path | Perm | Body | Returns |
|---|---|---|---|---|
| GET | `/shifts` | `reports.view` | — | `ShiftDTO[]` (recent; open carry live totals) |
| GET | `/shifts/current?locationId=` | `order.pay` | — | `ShiftDTO \| null` (live drawer math) |
| POST | `/shifts/open` | `order.pay` | `{ locationId?, openingFloatMinor }` | `ShiftDTO` |
| POST | `/shifts/:id/close` | `order.pay` | `{ countedCashMinor, note? }` | `ShiftDTO` (expected/counted/variance) |

Expected cash = opening float + cash sales − cash refunds during the session; variance = counted −
expected. Only one shift may be open per location at a time.

## Orders (auth staff)

| Method | Path | Perm | Body | Returns |
|---|---|---|---|---|
| POST | `/orders` | `order.take` | `{ channel, fulfillment, locationId?, tableId?, qrToken?, customer… }` | `OrderDTO` |
| GET | `/orders?status=` | — | — | `OrderDTO[]` |
| GET | `/kitchen` | `kitchen.view` | — | `OrderDTO[]` (KDS: CONFIRMED/READY) |
| GET | `/orders/:id` | — | — | `OrderDTO` (404 cross-tenant — GAP-05) |
| POST | `/orders/:id/events` | `order.take` | `{ events: OrderEventInput[] }` | `{ order, inserted, duplicates, conflicts }` |
| POST | `/orders/:id/pay` | `order.pay` | `{ rail, amountMinor, tipMinor?, tenderedMinor? }` | `{ order, payment, result }` |
| POST | `/orders/:id/status` | — | `{ status: CONFIRMED\|READY\|CLOSED\|VOID }` | `{ order }` |

## Sync — offline outbox (auth)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/sync` | `{ deviceId?, events: OrderEventInput[] }` | `{ inserted, duplicates, conflicts, orderIds, serverTime }` |
| GET | `/sync/state?deviceId=` | — | `{ lastSyncAt, serverTime, pendingOnServer }` (SYNC-05) |

Orders opened offline are created server-side from their queued `ORDER_CREATED` event.

## Reports (auth — `reports.view`)

| Method | Path | Returns |
|---|---|---|
| GET | `/reports/sales?from=&to=` | `SalesReport` (per-rail, per-channel, top items, by day) |
| GET | `/reports/sales.csv?from=&to=` | CSV (RPT-02) |

## `OrderEventInput`

```ts
{
  orderId: string;
  type: "ORDER_CREATED" | "ITEM_ADDED" | "ITEM_REMOVED" | "ITEM_QTY_CHANGED"
      | "PAYMENT_CAPTURED" | "ORDER_CONFIRMED" | "ORDER_READY" | "ORDER_CLOSED" | "ORDER_VOIDED";
  payload: object;            // validated per-type by EVENT_PAYLOAD_SCHEMAS
  deviceId?: string; staffId?: string;
  deviceTimestamp: string;    // ISO — the ordering key for conflict resolution (DB-09)
  idempotencyKey: string;     // unique — retried sync can't double-apply (BE-04/DB-08)
}
```

## Errors

`400` validation (`{ error, details }`), `401` unauthenticated, `403` missing permission /
cross-tenant, `404` not found, `429` rate limited, `500` internal.
