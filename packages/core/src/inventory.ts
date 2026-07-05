/**
 * Inventory service (INV-01/02). Growth/Enterprise merchants can track stock per menu item.
 *
 * Three things happen automatically so a busy counter never has to think about it:
 *   1. Confirming an order (sending it to the kitchen) deducts the sold quantity — driven by the
 *      in-process domain event bus (BE-03), so the order path never waits on the stock write.
 *   2. When a tracked item hits zero it is auto-"86'd" (marked unavailable) across every channel,
 *      exactly like a manual 86 (MENU-04) — the storefront, kiosk and POS stop offering it at once.
 *   3. Restocking above zero brings it back. Every change is written to StockMovement as an audit
 *      trail, so "where did the stock go" always has an answer.
 *
 * Deduction is idempotent per order: a replayed/duplicated confirm can't double-deduct.
 */
import { prisma } from "@shopmaster/db";
import { pickText, type Locale, type InventoryReport, type StockMovementDTO } from "@shopmaster/shared";
import { assertTenant, type TenantContext } from "./tenancy.js";
import { onDomainEvent, type DomainEvent } from "./events/emitter.js";

/** Full inventory view for the admin console: every item, its stock, and recent movements. */
export async function getInventory(ctx: TenantContext, locale: Locale = "en"): Promise<InventoryReport> {
  const items = await prisma.menuItem.findMany({
    where: { organizationId: ctx.organizationId },
    include: { inventory: true, category: true },
    orderBy: { sort: "asc" },
  });

  const rows = items.map((it) => {
    const tracked = !!it.inventory;
    const stockLevel = it.inventory?.stockLevel ?? 0;
    const reorderPoint = it.inventory?.reorderPoint ?? 0;
    return {
      menuItemId: it.id,
      name: pickText(it.name, locale),
      categoryName: pickText(it.category.name, locale),
      stockLevel,
      reorderPoint,
      tracked,
      low: tracked && stockLevel <= reorderPoint,
      available: it.available,
    };
  });

  const nameById = new Map(rows.map((r) => [r.menuItemId, r.name]));
  const recent = await prisma.stockMovement.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const movements: StockMovementDTO[] = recent.map((m) => ({
    id: m.id,
    menuItemId: m.menuItemId,
    name: nameById.get(m.menuItemId) ?? "—",
    delta: m.delta,
    reason: m.reason,
    orderId: m.orderId,
    createdAt: m.createdAt.toISOString(),
  }));

  return { rows, lowCount: rows.filter((r) => r.low).length, movements };
}

/** Set an absolute stock level (a physical stock-take), optionally updating the reorder point. */
export async function setStock(
  ctx: TenantContext,
  input: { menuItemId: string; stockLevel: number; reorderPoint?: number },
) {
  const item = await prisma.menuItem.findUnique({ where: { id: input.menuItemId } });
  assertTenant(ctx, item);

  const existing = await prisma.inventoryItem.findUnique({ where: { menuItemId: input.menuItemId } });
  const prevLevel = existing?.stockLevel ?? 0;

  const inv = await prisma.inventoryItem.upsert({
    where: { menuItemId: input.menuItemId },
    create: {
      organizationId: ctx.organizationId,
      menuItemId: input.menuItemId,
      stockLevel: input.stockLevel,
      reorderPoint: input.reorderPoint ?? 0,
    },
    update: {
      stockLevel: input.stockLevel,
      ...(input.reorderPoint !== undefined ? { reorderPoint: input.reorderPoint } : {}),
    },
  });

  const delta = input.stockLevel - prevLevel;
  if (delta !== 0) {
    await prisma.stockMovement.create({
      data: {
        organizationId: ctx.organizationId,
        menuItemId: input.menuItemId,
        delta,
        reason: delta > 0 ? "RESTOCK" : "ADJUST",
      },
    });
  }
  await syncAvailability(input.menuItemId, input.stockLevel, item!.available);
  return inv;
}

/** Apply a relative change: positive restocks, negative writes off wastage (INV-02). */
export async function adjustStock(
  ctx: TenantContext,
  input: { menuItemId: string; delta: number; reason?: "ADJUST" | "RESTOCK" },
) {
  const item = await prisma.menuItem.findUnique({ where: { id: input.menuItemId } });
  assertTenant(ctx, item);

  const existing = await prisma.inventoryItem.findUnique({ where: { menuItemId: input.menuItemId } });
  const prevLevel = existing?.stockLevel ?? 0;
  const newLevel = Math.max(0, prevLevel + input.delta);
  const appliedDelta = newLevel - prevLevel;

  const inv = await prisma.inventoryItem.upsert({
    where: { menuItemId: input.menuItemId },
    create: { organizationId: ctx.organizationId, menuItemId: input.menuItemId, stockLevel: newLevel, reorderPoint: 0 },
    update: { stockLevel: newLevel },
  });

  if (appliedDelta !== 0) {
    await prisma.stockMovement.create({
      data: {
        organizationId: ctx.organizationId,
        menuItemId: input.menuItemId,
        delta: appliedDelta,
        reason: input.reason ?? (appliedDelta > 0 ? "RESTOCK" : "ADJUST"),
      },
    });
  }
  await syncAvailability(input.menuItemId, newLevel, item!.available);
  return inv;
}

/**
 * Deduct sold quantities for a confirmed order (idempotent per order). Aggregates line quantities
 * per menu item, decrements tracked stock, records an ORDER movement, and auto-86's anything that
 * reaches zero. Untracked items are skipped — inventory is opt-in per item.
 */
export async function deductForOrder(orderId: string): Promise<void> {
  const already = await prisma.stockMovement.count({ where: { orderId, reason: "ORDER" } });
  if (already > 0) return; // a duplicated/replayed confirm must not double-deduct

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;

  const byItem = new Map<string, number>();
  for (const it of order.items) {
    if (it.voided || !it.menuItemId) continue;
    byItem.set(it.menuItemId, (byItem.get(it.menuItemId) ?? 0) + it.qty);
  }

  for (const [menuItemId, qty] of byItem) {
    const inv = await prisma.inventoryItem.findUnique({ where: { menuItemId } });
    if (!inv) continue; // untracked item — nothing to deduct
    const newLevel = Math.max(0, inv.stockLevel - qty);
    const applied = inv.stockLevel - newLevel;
    await prisma.inventoryItem.update({ where: { menuItemId }, data: { stockLevel: newLevel } });
    if (applied > 0) {
      await prisma.stockMovement.create({
        data: { organizationId: order.organizationId, menuItemId, delta: -applied, reason: "ORDER", orderId },
      });
    }
    if (newLevel === 0) {
      await prisma.menuItem.update({ where: { id: menuItemId }, data: { available: false } });
    }
  }
}

/** Auto-86 at zero, auto-un-86 when restocked above zero — mirrors the manual 86 flag (MENU-04). */
async function syncAvailability(menuItemId: string, stockLevel: number, currentlyAvailable: boolean): Promise<void> {
  if (stockLevel === 0 && currentlyAvailable) {
    await prisma.menuItem.update({ where: { id: menuItemId }, data: { available: false } });
  } else if (stockLevel > 0 && !currentlyAvailable) {
    await prisma.menuItem.update({ where: { id: menuItemId }, data: { available: true } });
  }
}

let subscribed = false;
/** Wire inventory deduction to the order lifecycle (BE-03). Call once at API startup; idempotent. */
export function registerInventorySubscriber(): void {
  if (subscribed) return;
  subscribed = true;
  onDomainEvent((e: DomainEvent) => {
    if (e.type === "order.confirmed") {
      // Fire-and-forget: a stock write must never block or break confirming an order.
      deductForOrder(e.orderId).catch(() => {
        /* swallowed — audit stays consistent on the next rebuild/confirm */
      });
    }
  });
}
