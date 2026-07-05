/**
 * Capability manifest (FE-06 / POS-12). A merchant's tier + business type resolve — on the server —
 * to the feature/navigation set the client is allowed to render. This is what makes "progressive
 * complexity" a runtime configuration, not a separate app build: the same installed client is a
 * three-button tea-stall POS or a full restaurant back office depending only on this manifest.
 */
import type { Tier, BusinessType } from "./constants.js";

export interface Capabilities {
  tier: Tier;
  businessType: BusinessType;
  /** POS-12: collapse the POS to add-item / show-total / take-payment. */
  quickMode: boolean;
  features: {
    tables: boolean; // dine-in table management (POS-03)
    splitBill: boolean; // POS-04
    kitchenDisplay: boolean; // KDS
    kiosk: boolean; // self-service kiosk (Phase 2 surface, gated here)
    onlineOrdering: boolean; // branded online ordering (WEB)
    qrOrdering: boolean; // QR/NFC table ordering (QR/NFC)
    inventory: boolean; // Phase 2
    loyalty: boolean; // Phase 2/3
    multiLocation: boolean; // Phase 3
    staffRoles: boolean; // multiple staff with roles (STAFF-01)
  };
  /** Admin console sections to show. */
  adminNav: string[];
}

const DINE_IN_TYPES: BusinessType[] = ["CAFE", "BAR", "RESTAURANT"];

export function resolveCapabilities(tier: Tier, businessType: BusinessType): Capabilities {
  const quickMode = tier === "STARTER" || businessType === "TEA_STALL" || businessType === "FOOD_TRUCK";
  const isGrowthPlus = tier === "GROWTH" || tier === "ENTERPRISE";

  const features = {
    tables: DINE_IN_TYPES.includes(businessType),
    splitBill: isGrowthPlus && DINE_IN_TYPES.includes(businessType),
    kitchenDisplay: isGrowthPlus,
    kiosk: isGrowthPlus,
    onlineOrdering: true, // branded online ordering is core MVP scope (PRD §6)
    qrOrdering: true,
    inventory: false, // Phase 2 — schema exists, feature gated off
    loyalty: false, // Phase 2/3
    multiLocation: tier === "ENTERPRISE",
    staffRoles: isGrowthPlus,
  };

  const adminNav = ["dashboard", "menu", "orders"];
  if (features.tables) adminNav.push("tables");
  if (features.staffRoles) adminNav.push("staff");
  adminNav.push("devices", "settings");

  return { tier, businessType, quickMode, features, adminNav };
}
