/** Role-based permissions (STAFF-01) — gates discounts, voids, refunds, reporting, settings. */
import type { Role } from "./constants.js";

export const PERMISSIONS = [
  "order.take", // add items, open orders
  "order.pay", // capture payment / close bill
  "order.void", // void an item/order (POS-11)
  "order.discount", // apply a discount/comp (POS-05)
  "order.refund", // refund (POS-11)
  "kitchen.view", // KDS
  "reports.view", // RPT
  "menu.manage", // ADMIN menu CRUD
  "staff.manage", // manage staff
  "settings.manage", // tax, tables, devices, org settings
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, Permission[]> = {
  OWNER: [...PERMISSIONS],
  MANAGER: [
    "order.take",
    "order.pay",
    "order.void",
    "order.discount",
    "order.refund",
    "kitchen.view",
    "reports.view",
    "menu.manage",
    "settings.manage",
  ],
  CASHIER: ["order.take", "order.pay", "kitchen.view"],
  WAITER: ["order.take", "kitchen.view"],
  KITCHEN: ["kitchen.view"],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return MATRIX[role] ?? [];
}
