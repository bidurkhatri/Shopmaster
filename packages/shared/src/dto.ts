/** Shared request/response DTOs used by both the API and the web client. */
import { z } from "zod";
import {
  zChannel,
  zFulfillment,
  zStation,
  zPaymentRail,
  type Tier,
  type BusinessType,
  type Role,
  type Currency,
  type Locale,
  type OrderStatus,
  type Channel,
  type Fulfillment,
  type PaymentStatus,
  type PaymentRail,
} from "./constants.js";
import type { Capabilities } from "./capabilities.js";
import type { Permission } from "./permissions.js";

/* ------------------------------- Auth (two-tier) ------------------------------- */

// Tier-1: owner/manager login (Auth-Flow A2/A3).
export const zLoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Tier-2: offline-capable staff PIN switch (Auth-Flow B1/B2).
export const zPinVerifyRequest = z.object({
  staffId: z.string().min(1),
  pin: z.string().min(3),
});

// Tier-1: device pairing (Auth-Flow A1–A6).
export const zPairRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: z.string().min(1),
  locationId: z.string().optional(),
});

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  organizationId: string;
  locationIds: string[];
  permissions: Permission[];
}

export interface AuthResponse {
  token: string;
  user: SessionUser;
  organization: OrganizationDTO;
  capabilities: Capabilities;
}

/* ------------------------------- Core DTOs ------------------------------- */

export interface OrganizationDTO {
  id: string;
  name: string;
  slug: string;
  tier: Tier;
  businessType: BusinessType;
  currency: Currency;
  locale: Locale;
  branding: { primaryColor?: string; accentColor?: string; logoText?: string } | null;
}

export interface StaffDTO {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  hasPassword: boolean;
}

export interface ModifierDTO {
  id: string;
  groupName: string;
  name: string; // localized
  priceDeltaMinor: number;
}

export interface MenuItemDTO {
  id: string;
  categoryId: string;
  name: string; // localized
  description: string | null; // localized
  priceMinor: number;
  available: boolean;
  photoUrl: string | null;
  station: string;
  modifiers: ModifierDTO[];
}

export interface MenuCategoryDTO {
  id: string;
  name: string; // localized
  sort: number;
  items: MenuItemDTO[];
}

export interface OrderItemDTO {
  id: string;
  lineId: string;
  menuItemId: string | null;
  nameSnapshot: string;
  unitPriceMinor: number;
  qty: number;
  modifiers: { name: string; priceDeltaMinor: number }[];
  lineTotalMinor: number;
  station: string;
  voided: boolean;
}

export interface PaymentDTO {
  id: string;
  rail: PaymentRail;
  amountMinor: number;
  tipMinor: number;
  currency: Currency;
  status: PaymentStatus;
  processorToken: string | null;
  tenderedMinor: number | null;
  changeMinor: number | null;
}

export interface OrderDTO {
  id: string;
  organizationId: string;
  locationId: string;
  tableId: string | null;
  tableLabel: string | null;
  channel: Channel;
  fulfillment: Fulfillment;
  status: OrderStatus;
  currency: Currency;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  tipMinor: number;
  balanceMinor: number;
  customerName: string | null;
  note: string | null;
  items: OrderItemDTO[];
  payments: PaymentDTO[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------- Menu admin DTOs ------------------------------- */

export const zUpsertCategory = z.object({
  nameEn: z.string().min(1),
  nameNe: z.string().optional(),
  sort: z.number().int().optional(),
});

export const zUpsertItem = z.object({
  categoryId: z.string().min(1),
  nameEn: z.string().min(1),
  nameNe: z.string().optional(),
  descriptionEn: z.string().optional(),
  descriptionNe: z.string().optional(),
  priceMinor: z.number().int().nonnegative(),
  station: zStation.optional(),
  photoUrl: z.string().optional(),
});

/* ------------------------------- Payment DTO ------------------------------- */

export const zPaymentRequest = z.object({
  rail: zPaymentRail,
  amountMinor: z.number().int().positive(),
  tipMinor: z.number().int().nonnegative().optional(), // PAY-06
  tenderedMinor: z.number().int().optional(),
});

export const zCreateOrderRequest = z.object({
  channel: zChannel,
  fulfillment: zFulfillment,
  locationId: z.string().optional(),
  tableId: z.string().optional(),
  qrToken: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  deliveryAddress: z.string().optional(),
  note: z.string().optional(),
});

/* ------------------------------- Inventory (INV-01/02) ------------------------------- */

export interface InventoryRowDTO {
  menuItemId: string;
  name: string; // localized item name
  categoryName: string; // localized
  stockLevel: number;
  reorderPoint: number;
  tracked: boolean; // false = no InventoryItem row yet (untracked)
  low: boolean; // stockLevel <= reorderPoint
  available: boolean; // the item's 86 flag
}

export interface StockMovementDTO {
  id: string;
  menuItemId: string;
  name: string;
  delta: number;
  reason: string; // ORDER | ADJUST | RESTOCK
  orderId: string | null;
  createdAt: string;
}

export interface InventoryReport {
  rows: InventoryRowDTO[];
  lowCount: number;
  movements: StockMovementDTO[];
}

// Set an absolute stock level (a physical stock-take).
export const zSetStockRequest = z.object({
  menuItemId: z.string().min(1),
  stockLevel: z.number().int().nonnegative(),
  reorderPoint: z.number().int().nonnegative().optional(),
});

// Apply a relative change (restock / wastage). Positive = restock, negative = adjust down.
export const zAdjustStockRequest = z.object({
  menuItemId: z.string().min(1),
  delta: z.number().int(),
  reason: z.enum(["ADJUST", "RESTOCK"]).optional(),
});

/* ------------------------------- Reports ------------------------------- */

export interface SalesReport {
  currency: Currency;
  from: string;
  to: string;
  orderCount: number;
  grossMinor: number;
  taxMinor: number;
  netMinor: number;
  tipsMinor: number;
  byRail: { rail: PaymentRail; amountMinor: number; count: number }[];
  byChannel: { channel: Channel; amountMinor: number; count: number }[];
  topItems: { name: string; qty: number; revenueMinor: number }[];
  byDay: { date: string; amountMinor: number; orderCount: number }[];
}
