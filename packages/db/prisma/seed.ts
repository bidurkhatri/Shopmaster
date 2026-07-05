/**
 * ShopMaster seed — two tenants that demonstrate "progressive complexity" (Principle 2):
 *   A) Himalayan Tea House — Nepal, Starter tier, quick mode, NPR, VAT-inclusive.
 *   B) Harbour View Kitchen — Sydney, Growth tier, full mode, AUD, GST-exclusive.
 *
 * Run with: pnpm --filter @shopmaster/db seed
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SALT_ROUNDS = 8;
const hash = (s: string) => bcrypt.hashSync(s, SALT_ROUNDS);

/** Inclusive (NP VAT) vs exclusive (AU GST) tax, mirrored from @shopmaster/core/pricing-tax. */
function computeTax(subtotalMinor: number, taxRateBps: number, inclusive: boolean) {
  const rate = taxRateBps / 10_000;
  if (inclusive) {
    const net = Math.round(subtotalMinor / (1 + rate));
    return { taxMinor: subtotalMinor - net, totalMinor: subtotalMinor };
  }
  const taxMinor = Math.round(subtotalMinor * rate);
  return { taxMinor, totalMinor: subtotalMinor + taxMinor };
}

// JSON-encoded i18n value (SQLite stores JSON as text).
const t = (en: string, ne: string) => JSON.stringify({ en, ne });
const daysAgo = (n: number, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor((hour * 37) % 60), 0, 0);
  return d;
};

async function reset() {
  // Delete in FK-safe order.
  await prisma.orderEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.auditLogEntry.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.modifier.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.tableOrTab.deleteMany();
  await prisma.device.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.location.deleteMany();
  await prisma.organization.deleteMany();
}

async function seedTeaStall() {
  const org = await prisma.organization.create({
    data: {
      name: "Himalayan Tea House",
      slug: "himalayan-tea",
      tier: "STARTER",
      businessType: "TEA_STALL",
      currency: "NPR",
      locale: "ne",
      branding: JSON.stringify({ primaryColor: "#b45309", accentColor: "#f59e0b", logoText: "हिमालयन चिया" }),
    },
  });

  const loc = await prisma.location.create({
    data: {
      organizationId: org.id,
      name: "Attariya Stall",
      address: "Attariya Bazar, Kailali",
      taxJurisdiction: "NP_VAT",
      taxRateBps: 1300,
      taxInclusive: true,
    },
  });

  await prisma.staffMember.create({
    data: {
      organizationId: org.id,
      name: "Sita (Owner)",
      email: "owner@himalayan-tea.test",
      role: "OWNER",
      pinHash: hash("1234"),
      passwordHash: hash("password123"),
    },
  });

  // One counter QR (counter-service format).
  await prisma.tableOrTab.create({
    data: { locationId: loc.id, label: "Counter", qrToken: "tea-counter", status: "CLOSED" },
  });

  const cat = await prisma.menuCategory.create({
    data: { organizationId: org.id, name: t("Tea & Snacks", "चिया र खाजा"), sort: 0 },
  });

  const items: Array<[ReturnType<typeof t>, number, string]> = [
    [t("Milk Tea", "दूध चिया"), 3000, "KITCHEN"],
    [t("Black Tea", "कालो चिया"), 2000, "KITCHEN"],
    [t("Masala Tea", "मसला चिया"), 3500, "KITCHEN"],
    [t("Milk Coffee", "दूध कफी"), 5000, "KITCHEN"],
    [t("Samosa", "समोसा"), 2500, "KITCHEN"],
    [t("Sel Roti", "सेल रोटी"), 3000, "KITCHEN"],
  ];
  const created = [];
  for (let i = 0; i < items.length; i++) {
    const [name, price, station] = items[i]!;
    created.push(
      await prisma.menuItem.create({
        data: { organizationId: org.id, categoryId: cat.id, name, priceMinor: price, station, sort: i },
      }),
    );
  }

  // A couple of quick cash sales for the reporting dashboard.
  await createClosedOrder({
    org,
    loc,
    channel: "POS",
    fulfillment: "PICKUP",
    when: daysAgo(1, 8),
    lines: [
      { item: created[0]!, qty: 2 },
      { item: created[4]!, qty: 1 },
    ],
    rail: "CASH",
  });
  await createClosedOrder({
    org,
    loc,
    channel: "QR",
    fulfillment: "DINE_IN",
    when: daysAgo(0, 9),
    lines: [{ item: created[2]!, qty: 1 }],
    rail: "FONEPAY",
  });

  return org;
}

async function seedRestaurant() {
  const org = await prisma.organization.create({
    data: {
      name: "Harbour View Kitchen",
      slug: "harbour-view",
      tier: "GROWTH",
      businessType: "RESTAURANT",
      currency: "AUD",
      locale: "en",
      branding: JSON.stringify({ primaryColor: "#0f766e", accentColor: "#14b8a6", logoText: "Harbour View" }),
    },
  });

  const loc = await prisma.location.create({
    data: {
      organizationId: org.id,
      name: "Sydney CBD",
      address: "12 Circular Quay, Sydney NSW",
      taxJurisdiction: "AU_GST",
      taxRateBps: 1000,
      taxInclusive: false,
    },
  });

  const staff: Array<[string, string, string]> = [
    ["Alex (Owner)", "OWNER", "1111"],
    ["Morgan (Manager)", "MANAGER", "2222"],
    ["Jamie (Cashier)", "CASHIER", "3333"],
    ["Riley (Waiter)", "WAITER", "4444"],
    ["Kai (Kitchen)", "KITCHEN", "5555"],
  ];
  for (const [name, role, pin] of staff) {
    await prisma.staffMember.create({
      data: {
        organizationId: org.id,
        name,
        email: `${role.toLowerCase()}@harbour-view.test`,
        role,
        pinHash: hash(pin),
        passwordHash: role === "OWNER" || role === "MANAGER" ? hash("password123") : null,
      },
    });
  }

  for (let i = 1; i <= 8; i++) {
    await prisma.tableOrTab.create({
      data: { locationId: loc.id, label: `T${i}`, qrToken: `hv-t${i}`, status: "CLOSED" },
    });
  }

  const mkCat = (name: string, sort: number) =>
    prisma.menuCategory.create({ data: { organizationId: org.id, name: t(name, name), sort } });
  const coffee = await mkCat("Coffee", 0);
  const breakfast = await mkCat("Breakfast", 1);
  const mains = await mkCat("Mains", 2);
  const bar = await mkCat("Bar", 3);
  const desserts = await mkCat("Desserts", 4);

  const mkItem = (
    categoryId: string,
    name: string,
    priceMinor: number,
    station = "KITCHEN",
    sort = 0,
  ) =>
    prisma.menuItem.create({
      data: { organizationId: org.id, categoryId, name: t(name, name), priceMinor, station, sort },
    });

  const flatWhite = await mkItem(coffee.id, "Flat White", 480, "BAR", 0);
  await mkItem(coffee.id, "Long Black", 450, "BAR", 1);
  await mkItem(coffee.id, "Cappuccino", 480, "BAR", 2);
  const avoToast = await mkItem(breakfast.id, "Avocado Toast", 1650, "KITCHEN", 0);
  const bigBreak = await mkItem(breakfast.id, "Big Breakfast", 2450, "KITCHEN", 1);
  await mkItem(breakfast.id, "Eggs Benedict", 1950, "KITCHEN", 2);
  const burger = await mkItem(mains.id, "Beef Burger", 2200, "KITCHEN", 0);
  const fishChips = await mkItem(mains.id, "Fish & Chips", 2600, "KITCHEN", 1);
  await mkItem(mains.id, "Caesar Salad", 1800, "KITCHEN", 2);
  const lager = await mkItem(bar.id, "Craft Lager", 900, "BAR", 0);
  await mkItem(bar.id, "House Red (glass)", 1100, "BAR", 1);
  await mkItem(desserts.id, "Sticky Date Pudding", 1400, "KITCHEN", 0);

  // Modifiers
  await prisma.modifier.createMany({
    data: [
      { menuItemId: flatWhite.id, groupName: "Milk", name: t("Oat milk", "Oat milk"), priceDeltaMinor: 60, sort: 0 },
      { menuItemId: flatWhite.id, groupName: "Milk", name: t("Extra shot", "Extra shot"), priceDeltaMinor: 50, sort: 1 },
      { menuItemId: burger.id, groupName: "Extras", name: t("Add bacon", "Add bacon"), priceDeltaMinor: 300, sort: 0 },
      { menuItemId: burger.id, groupName: "Extras", name: t("Add cheese", "Add cheese"), priceDeltaMinor: 150, sort: 1 },
    ],
  });

  // Inventory (INV) — a few tracked items; two start below their reorder point to show low-stock alerts.
  await prisma.inventoryItem.createMany({
    data: [
      { organizationId: org.id, menuItemId: burger.id, stockLevel: 14, reorderPoint: 6 },
      { organizationId: org.id, menuItemId: fishChips.id, stockLevel: 3, reorderPoint: 5 },
      { organizationId: org.id, menuItemId: lager.id, stockLevel: 48, reorderPoint: 12 },
      { organizationId: org.id, menuItemId: avoToast.id, stockLevel: 9, reorderPoint: 4 },
      { organizationId: org.id, menuItemId: bigBreak.id, stockLevel: 2, reorderPoint: 4 },
    ],
  });

  // Historical orders across the last 6 days for the reporting dashboard.
  const menu = { flatWhite, avoToast, bigBreak, burger, fishChips, lager };
  const plan: Array<{
    channel: string;
    fulfillment: string;
    day: number;
    hour: number;
    lines: Array<{ item: (typeof menu)[keyof typeof menu]; qty: number }>;
    rail: string;
  }> = [
    { channel: "POS", fulfillment: "DINE_IN", day: 0, hour: 8, lines: [{ item: flatWhite, qty: 2 }, { item: avoToast, qty: 1 }], rail: "TYRO" },
    { channel: "QR", fulfillment: "DINE_IN", day: 0, hour: 12, lines: [{ item: burger, qty: 1 }, { item: lager, qty: 1 }], rail: "TYRO" },
    { channel: "ONLINE", fulfillment: "PICKUP", day: 1, hour: 13, lines: [{ item: fishChips, qty: 2 }], rail: "TYRO" },
    { channel: "POS", fulfillment: "DINE_IN", day: 1, hour: 19, lines: [{ item: bigBreak, qty: 1 }, { item: flatWhite, qty: 1 }], rail: "CASH" },
    { channel: "KIOSK", fulfillment: "PICKUP", day: 2, hour: 9, lines: [{ item: flatWhite, qty: 1 }, { item: avoToast, qty: 2 }], rail: "TYRO" },
    { channel: "QR", fulfillment: "DINE_IN", day: 3, hour: 20, lines: [{ item: burger, qty: 2 }, { item: lager, qty: 3 }], rail: "TYRO" },
    { channel: "ONLINE", fulfillment: "DELIVERY", day: 4, hour: 18, lines: [{ item: fishChips, qty: 1 }, { item: burger, qty: 1 }], rail: "TYRO" },
    { channel: "POS", fulfillment: "DINE_IN", day: 5, hour: 12, lines: [{ item: bigBreak, qty: 2 }], rail: "CASH" },
  ];
  for (const p of plan) {
    await createClosedOrder({
      org,
      loc,
      channel: p.channel,
      fulfillment: p.fulfillment,
      when: daysAgo(p.day, p.hour),
      lines: p.lines,
      rail: p.rail,
    });
  }

  return org;
}

async function createClosedOrder(opts: {
  org: { id: string; currency: string };
  loc: { id: string; taxRateBps: number; taxInclusive: boolean };
  channel: string;
  fulfillment: string;
  when: Date;
  lines: Array<{ item: { id: string; name: string; priceMinor: number; station: string }; qty: number }>;
  rail: string;
}) {
  const { org, loc, when } = opts;
  let subtotal = 0;
  const itemData = opts.lines.map((l, idx) => {
    const lineTotal = l.item.priceMinor * l.qty;
    subtotal += lineTotal;
    const nm = JSON.parse(l.item.name) as { en: string };
    return {
      menuItemId: l.item.id,
      lineId: `seed-${idx}`,
      nameSnapshot: nm.en,
      unitPriceMinor: l.item.priceMinor,
      qty: l.qty,
      lineTotalMinor: lineTotal,
      station: l.item.station,
    };
  });
  const { taxMinor, totalMinor } = computeTax(subtotal, loc.taxRateBps, loc.taxInclusive);

  const order = await prisma.order.create({
    data: {
      organizationId: org.id,
      locationId: loc.id,
      channel: opts.channel,
      fulfillment: opts.fulfillment,
      status: "CLOSED",
      currency: org.currency,
      subtotalMinor: subtotal,
      taxMinor,
      totalMinor,
      paidMinor: totalMinor,
      createdAt: when,
      updatedAt: when,
      closedAt: when,
      items: { create: itemData },
    },
  });

  await prisma.payment.create({
    data: {
      organizationId: org.id,
      orderId: order.id,
      rail: opts.rail,
      amountMinor: totalMinor,
      currency: org.currency,
      status: "CAPTURED",
      processorToken: opts.rail === "CASH" ? null : `seed_${opts.rail.toLowerCase()}_${order.id.slice(-6)}`,
      tenderedMinor: opts.rail === "CASH" ? totalMinor : null,
      changeMinor: opts.rail === "CASH" ? 0 : null,
      createdAt: when,
    },
  });

  // A minimal, authentic event trail so the log isn't empty for historical orders.
  await prisma.orderEvent.create({
    data: {
      organizationId: org.id,
      locationId: loc.id,
      orderId: order.id,
      type: "ORDER_CLOSED",
      payload: JSON.stringify({ seeded: true }),
      deviceTimestamp: when,
      idempotencyKey: `seed-close-${order.id}`,
      receivedAt: when,
    },
  });

  return order;
}

async function main() {
  console.log("Resetting database…");
  await reset();
  console.log("Seeding Himalayan Tea House (Nepal, Starter)…");
  await seedTeaStall();
  console.log("Seeding Harbour View Kitchen (Sydney, Growth)…");
  await seedRestaurant();

  const counts = {
    organizations: await prisma.organization.count(),
    staff: await prisma.staffMember.count(),
    menuItems: await prisma.menuItem.count(),
    tables: await prisma.tableOrTab.count(),
    orders: await prisma.order.count(),
    payments: await prisma.payment.count(),
  };
  console.log("Seed complete:", counts);
  console.log("\nDemo logins (password123 for OWNER/MANAGER):");
  console.log("  Nepal tea stall : owner@himalayan-tea.test  · PIN 1234 · storefront /s/himalayan-tea");
  console.log("  Sydney restaurant: owner@harbour-view.test  · PIN 1111 · storefront /s/harbour-view · QR /t/hv-t1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
