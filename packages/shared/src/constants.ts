/**
 * Allowed-value sets + Zod enums. On SQLite these live as `String` columns; this file is the
 * single place the allowed values are defined, and it's shared by the API and the web client so
 * the two never drift (BE-01). In Postgres these become native enums.
 */
import { z } from "zod";

export const TIERS = ["STARTER", "GROWTH", "ENTERPRISE"] as const;
export const BUSINESS_TYPES = [
  "TEA_STALL",
  "CAFE",
  "BAR",
  "RESTAURANT",
  "FOOD_TRUCK",
  "TAKEAWAY",
  "QSR",
] as const;
export const ROLES = ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN"] as const;
export const CURRENCIES = ["AUD", "NPR"] as const;
export const LOCALES = ["en", "ne"] as const;
export const TAX_JURISDICTIONS = ["AU_GST", "NP_VAT"] as const;
export const CHANNELS = ["POS", "KIOSK", "QR", "ONLINE"] as const;
export const FULFILLMENTS = ["DINE_IN", "PICKUP", "DELIVERY"] as const;
export const ORDER_STATUSES = ["OPEN", "CONFIRMED", "READY", "CLOSED", "VOID"] as const;
export const PAYMENT_STATUSES = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED"] as const;
export const PAYMENT_RAILS = ["CASH", "FONEPAY", "ESEWA", "KHALTI", "TYRO"] as const;
export const STATIONS = ["KITCHEN", "BAR"] as const;
export const ORDER_EVENT_TYPES = [
  "ORDER_CREATED",
  "ITEM_ADDED",
  "ITEM_REMOVED",
  "ITEM_QTY_CHANGED",
  "PAYMENT_CAPTURED",
  "ORDER_CONFIRMED",
  "ORDER_READY",
  "ORDER_CLOSED",
  "ORDER_VOIDED",
] as const;

export type Tier = (typeof TIERS)[number];
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type Role = (typeof ROLES)[number];
export type Currency = (typeof CURRENCIES)[number];
export type Locale = (typeof LOCALES)[number];
export type TaxJurisdiction = (typeof TAX_JURISDICTIONS)[number];
export type Channel = (typeof CHANNELS)[number];
export type Fulfillment = (typeof FULFILLMENTS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentRail = (typeof PAYMENT_RAILS)[number];
export type Station = (typeof STATIONS)[number];
export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

export const zTier = z.enum(TIERS);
export const zBusinessType = z.enum(BUSINESS_TYPES);
export const zRole = z.enum(ROLES);
export const zCurrency = z.enum(CURRENCIES);
export const zLocale = z.enum(LOCALES);
export const zTaxJurisdiction = z.enum(TAX_JURISDICTIONS);
export const zChannel = z.enum(CHANNELS);
export const zFulfillment = z.enum(FULFILLMENTS);
export const zOrderStatus = z.enum(ORDER_STATUSES);
export const zPaymentStatus = z.enum(PAYMENT_STATUSES);
export const zPaymentRail = z.enum(PAYMENT_RAILS);
export const zStation = z.enum(STATIONS);
export const zOrderEventType = z.enum(ORDER_EVENT_TYPES);

/**
 * Which payment rails apply to a currency/market (Payment-Integration §2/§4).
 * Nepal → cash + the interoperable/wallet rails; Australia → cash + Tyro. No Web3 anywhere here,
 * and by construction no crypto path ever reaches a Nepali (NPR) merchant.
 */
export function railsForCurrency(currency: Currency): PaymentRail[] {
  return currency === "NPR" ? ["CASH", "FONEPAY", "ESEWA", "KHALTI"] : ["CASH", "TYRO"];
}
