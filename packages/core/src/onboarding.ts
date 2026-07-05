/**
 * Merchant self-onboarding (GAP-07) — the PRD headline "15 minutes to first sale" (PRD §5).
 *
 * One call stands up a complete, immediately-usable tenant so a merchant can go from signup to a
 * live order with zero hardware and no back-office setup:
 *   - an Organization on the STARTER tier, with a unique slug and a default branding object (AUTHZ-05);
 *   - its first Location, pre-configured with the correct tax regime for the currency (LOC-02):
 *       NPR → NP_VAT / 1300 bps / inclusive · AUD → AU_GST / 1000 bps / exclusive;
 *   - the owner StaffMember (role OWNER) with password + PIN hashed via hashPassword/hashPin (Auth-Flow);
 *   - a small starter menu (a few categories, a couple of items each) so the POS isn't empty on
 *     first login and the very first sale is one tap away.
 *
 * Everything is created in a single transaction so a failed signup never leaves a half-built tenant.
 * Patterns here mirror packages/core/src/menu.ts (i18n names, sort ordering) and the seed script.
 */
import { prisma } from "@shopmaster/db";
import { i18n, type BusinessType, type Currency } from "@shopmaster/shared";
import { hashPassword, hashPin } from "./auth.js";

export interface CreateMerchantInput {
  orgName: string;
  businessType: BusinessType;
  currency: Currency;
  ownerName: string;
  ownerEmail: string;
  password: string;
  pin: string;
}

export interface CreateMerchantResult {
  organizationId: string;
  ownerId: string;
  slug: string;
}

/** Currency picks the tax regime (LOC-02): NP VAT is price-inclusive @13%; AU GST is added on top @10%. */
function taxDefaultsFor(currency: Currency): {
  taxJurisdiction: string;
  taxRateBps: number;
  taxInclusive: boolean;
} {
  return currency === "NPR"
    ? { taxJurisdiction: "NP_VAT", taxRateBps: 1300, taxInclusive: true }
    : { taxJurisdiction: "AU_GST", taxRateBps: 1000, taxInclusive: false };
}

/** A neutral default brand the owner can restyle later in Admin (WEB-01 / BrandStyle). */
function defaultBranding(orgName: string): { primaryColor: string; accentColor: string; logoText: string } {
  return { primaryColor: "#0f766e", accentColor: "#14b8a6", logoText: orgName };
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base || "store";
}

/** Organization.slug is globally unique — probe and suffix until we land on a free one. */
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  for (let n = 2; ; n++) {
    const existing = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    candidate = `${base}-${n}`;
  }
}

interface StarterItem {
  nameEn: string;
  nameNe?: string;
  /** Placeholder price in minor units at AUD scale; scaled up for NPR so it reads sensibly. */
  priceBaseMinor: number;
  station?: "KITCHEN" | "BAR";
}
interface StarterCategory {
  nameEn: string;
  nameNe?: string;
  items: StarterItem[];
}

/**
 * A tiny business-type-appropriate starter menu. These are editable placeholders — the point is that
 * the merchant's POS has something to tap on the first login, not a curated catalogue (GAP-07).
 */
const STARTER_MENUS: Record<BusinessType, StarterCategory[]> = {
  TEA_STALL: [
    {
      nameEn: "Tea",
      nameNe: "चिया",
      items: [
        { nameEn: "Milk Tea", nameNe: "दूध चिया", priceBaseMinor: 300 },
        { nameEn: "Black Tea", nameNe: "कालो चिया", priceBaseMinor: 200 },
        { nameEn: "Masala Tea", nameNe: "मसला चिया", priceBaseMinor: 350 },
      ],
    },
    {
      nameEn: "Snacks",
      nameNe: "खाजा",
      items: [
        { nameEn: "Samosa", nameNe: "समोसा", priceBaseMinor: 250 },
        { nameEn: "Biscuits", nameNe: "बिस्कुट", priceBaseMinor: 150 },
      ],
    },
  ],
  CAFE: [
    {
      nameEn: "Coffee",
      items: [
        { nameEn: "Flat White", priceBaseMinor: 480, station: "BAR" },
        { nameEn: "Long Black", priceBaseMinor: 450, station: "BAR" },
        { nameEn: "Cappuccino", priceBaseMinor: 480, station: "BAR" },
      ],
    },
    {
      nameEn: "Food",
      items: [
        { nameEn: "Toasted Sandwich", priceBaseMinor: 950 },
        { nameEn: "Muffin", priceBaseMinor: 550 },
      ],
    },
    {
      nameEn: "Cold Drinks",
      items: [
        { nameEn: "Iced Coffee", priceBaseMinor: 600, station: "BAR" },
        { nameEn: "Orange Juice", priceBaseMinor: 500, station: "BAR" },
      ],
    },
  ],
  BAR: [
    {
      nameEn: "Beer",
      items: [
        { nameEn: "Draught Beer", priceBaseMinor: 900, station: "BAR" },
        { nameEn: "Craft Lager", priceBaseMinor: 1000, station: "BAR" },
      ],
    },
    {
      nameEn: "Wine",
      items: [
        { nameEn: "House Red (glass)", priceBaseMinor: 1100, station: "BAR" },
        { nameEn: "House White (glass)", priceBaseMinor: 1100, station: "BAR" },
      ],
    },
    {
      nameEn: "Snacks",
      items: [
        { nameEn: "Fries", priceBaseMinor: 800 },
        { nameEn: "Chicken Wings", priceBaseMinor: 1400 },
      ],
    },
  ],
  RESTAURANT: [
    {
      nameEn: "Starters",
      items: [
        { nameEn: "Garlic Bread", priceBaseMinor: 900 },
        { nameEn: "Soup of the Day", priceBaseMinor: 1100 },
      ],
    },
    {
      nameEn: "Mains",
      items: [
        { nameEn: "Grilled Chicken", priceBaseMinor: 2400 },
        { nameEn: "Vegetable Curry", priceBaseMinor: 1900 },
      ],
    },
    {
      nameEn: "Drinks",
      items: [
        { nameEn: "Soft Drink", priceBaseMinor: 400, station: "BAR" },
        { nameEn: "Sparkling Water", priceBaseMinor: 350, station: "BAR" },
      ],
    },
  ],
  FOOD_TRUCK: [
    {
      nameEn: "Mains",
      items: [
        { nameEn: "Loaded Fries", priceBaseMinor: 1200 },
        { nameEn: "Signature Burger", priceBaseMinor: 1400 },
      ],
    },
    {
      nameEn: "Sides",
      items: [
        { nameEn: "Fries", priceBaseMinor: 700 },
        { nameEn: "Onion Rings", priceBaseMinor: 800 },
      ],
    },
    {
      nameEn: "Drinks",
      items: [
        { nameEn: "Soft Drink", priceBaseMinor: 400, station: "BAR" },
        { nameEn: "Water", priceBaseMinor: 300, station: "BAR" },
      ],
    },
  ],
  TAKEAWAY: [
    {
      nameEn: "Meals",
      items: [
        { nameEn: "Chicken Box", priceBaseMinor: 1300 },
        { nameEn: "Vegetable Box", priceBaseMinor: 1100 },
      ],
    },
    {
      nameEn: "Sides",
      items: [
        { nameEn: "Fries", priceBaseMinor: 600 },
        { nameEn: "Spring Rolls", priceBaseMinor: 700 },
      ],
    },
    {
      nameEn: "Drinks",
      items: [
        { nameEn: "Soft Drink", priceBaseMinor: 400, station: "BAR" },
        { nameEn: "Water", priceBaseMinor: 300, station: "BAR" },
      ],
    },
  ],
  QSR: [
    {
      nameEn: "Combos",
      items: [
        { nameEn: "Classic Combo", priceBaseMinor: 1500 },
        { nameEn: "Veggie Combo", priceBaseMinor: 1300 },
      ],
    },
    {
      nameEn: "Burgers",
      items: [
        { nameEn: "Cheeseburger", priceBaseMinor: 900 },
        { nameEn: "Veggie Burger", priceBaseMinor: 850 },
      ],
    },
    {
      nameEn: "Drinks",
      items: [
        { nameEn: "Soft Drink", priceBaseMinor: 400, station: "BAR" },
        { nameEn: "Water", priceBaseMinor: 300, station: "BAR" },
      ],
    },
  ],
};

/**
 * Provision a brand-new merchant tenant end to end (GAP-07). Returns the ids the caller needs to
 * mint an owner session (the API route reuses buildAuthResponse to hand back an AuthResponse).
 */
export async function createMerchant(input: CreateMerchantInput): Promise<CreateMerchantResult> {
  const orgName = input.orgName.trim();
  const currency = input.currency;
  const locale = currency === "NPR" ? "ne" : "en";
  const tax = taxDefaultsFor(currency);
  const slug = await uniqueSlug(orgName);
  const starter = STARTER_MENUS[input.businessType] ?? STARTER_MENUS.CAFE;
  const priceScale = currency === "NPR" ? 10 : 1;

  // Hash outside the transaction — bcrypt is CPU-bound; keep the DB transaction short.
  const passwordHash = hashPassword(input.password);
  const pinHash = hashPin(input.pin);

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: orgName,
        slug,
        tier: "STARTER",
        businessType: input.businessType,
        currency,
        locale,
        branding: JSON.stringify(defaultBranding(orgName)),
        // The org's first (and, on Starter, only) location, pre-taxed for the currency (LOC-02).
        locations: {
          create: {
            name: orgName,
            taxJurisdiction: tax.taxJurisdiction,
            taxRateBps: tax.taxRateBps,
            taxInclusive: tax.taxInclusive,
          },
        },
      },
    });

    const owner = await tx.staffMember.create({
      data: {
        organizationId: org.id,
        name: input.ownerName.trim(),
        email: input.ownerEmail.trim().toLowerCase(),
        role: "OWNER",
        pinHash,
        passwordHash,
      },
    });

    // Starter menu so the POS isn't empty on first login (GAP-07 activation moment).
    for (let ci = 0; ci < starter.length; ci++) {
      const cat = starter[ci]!;
      const category = await tx.menuCategory.create({
        data: { organizationId: org.id, name: i18n(cat.nameEn, cat.nameNe), sort: ci },
      });
      for (let ii = 0; ii < cat.items.length; ii++) {
        const it = cat.items[ii]!;
        await tx.menuItem.create({
          data: {
            organizationId: org.id,
            categoryId: category.id,
            name: i18n(it.nameEn, it.nameNe),
            priceMinor: it.priceBaseMinor * priceScale,
            station: it.station ?? "KITCHEN",
            sort: ii,
          },
        });
      }
    }

    return { organizationId: org.id, ownerId: owner.id, slug };
  });
}
