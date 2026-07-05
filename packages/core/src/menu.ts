/** Menu / catalog service (MENU-01..05). Single source of truth for every channel. */
import { prisma } from "@shopmaster/db";
import { pickText, i18n, type Locale, type MenuCategoryDTO } from "@shopmaster/shared";
import type { TenantContext } from "./tenancy.js";
import { assertTenant } from "./tenancy.js";

export async function getMenuTree(organizationId: string, locale: Locale = "en"): Promise<MenuCategoryDTO[]> {
  const cats = await prisma.menuCategory.findMany({
    where: { organizationId, active: true },
    orderBy: { sort: "asc" },
    include: {
      items: {
        orderBy: { sort: "asc" },
        include: { modifiers: { orderBy: { sort: "asc" } } },
      },
    },
  });

  return cats.map((c) => ({
    id: c.id,
    name: pickText(c.name, locale),
    sort: c.sort,
    items: c.items.map((i) => ({
      id: i.id,
      categoryId: i.categoryId,
      name: pickText(i.name, locale),
      description: i.description ? pickText(i.description, locale) : null,
      priceMinor: i.priceMinor,
      available: i.available,
      photoUrl: i.photoUrl,
      station: i.station,
      modifiers: i.modifiers.map((m) => ({
        id: m.id,
        groupName: m.groupName,
        name: pickText(m.name, locale),
        priceDeltaMinor: m.priceDeltaMinor,
      })),
    })),
  }));
}

export async function createCategory(
  ctx: TenantContext,
  input: { nameEn: string; nameNe?: string; sort?: number },
) {
  return prisma.menuCategory.create({
    data: {
      organizationId: ctx.organizationId,
      name: i18n(input.nameEn, input.nameNe),
      sort: input.sort ?? 0,
    },
  });
}

export async function createItem(
  ctx: TenantContext,
  input: {
    categoryId: string;
    nameEn: string;
    nameNe?: string;
    descriptionEn?: string;
    descriptionNe?: string;
    priceMinor: number;
    station?: string;
    photoUrl?: string;
  },
) {
  const cat = await prisma.menuCategory.findUnique({ where: { id: input.categoryId } });
  assertTenant(ctx, cat);
  return prisma.menuItem.create({
    data: {
      organizationId: ctx.organizationId,
      categoryId: input.categoryId,
      name: i18n(input.nameEn, input.nameNe),
      description: input.descriptionEn ? i18n(input.descriptionEn, input.descriptionNe) : null,
      priceMinor: input.priceMinor,
      station: input.station ?? "KITCHEN",
      photoUrl: input.photoUrl ?? null,
    },
  });
}

/** One-tap "86" — mark out of stock; instantly reflected on every channel (MENU-04). */
export async function setItemAvailability(ctx: TenantContext, itemId: string, available: boolean) {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  assertTenant(ctx, item);
  await prisma.auditLogEntry.create({
    data: {
      organizationId: ctx.organizationId,
      actorId: ctx.staffId ?? null,
      action: available ? "ITEM_UN86" : "ITEM_86",
      target: `item:${itemId}`,
    },
  });
  return prisma.menuItem.update({ where: { id: itemId }, data: { available } });
}
