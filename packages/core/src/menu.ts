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

export async function updateItem(
  ctx: TenantContext,
  itemId: string,
  patch: {
    nameEn?: string;
    nameNe?: string;
    descriptionEn?: string;
    descriptionNe?: string;
    priceMinor?: number;
    station?: string;
    categoryId?: string;
    photoUrl?: string | null;
  },
) {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  assertTenant(ctx, item);
  const data: Record<string, unknown> = {};
  if (patch.nameEn !== undefined) data.name = i18n(patch.nameEn, patch.nameNe);
  if (patch.descriptionEn !== undefined) data.description = patch.descriptionEn ? i18n(patch.descriptionEn, patch.descriptionNe) : null;
  if (patch.priceMinor !== undefined) data.priceMinor = patch.priceMinor;
  if (patch.station !== undefined) data.station = patch.station;
  if (patch.categoryId !== undefined) data.categoryId = patch.categoryId;
  if (patch.photoUrl !== undefined) data.photoUrl = patch.photoUrl;
  return prisma.menuItem.update({ where: { id: itemId }, data });
}

export async function deleteItem(ctx: TenantContext, itemId: string) {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  assertTenant(ctx, item);
  await prisma.menuItem.delete({ where: { id: itemId } });
  return { ok: true };
}

export async function updateCategory(ctx: TenantContext, categoryId: string, patch: { nameEn?: string; nameNe?: string; sort?: number }) {
  const cat = await prisma.menuCategory.findUnique({ where: { id: categoryId } });
  assertTenant(ctx, cat);
  const data: Record<string, unknown> = {};
  if (patch.nameEn !== undefined) data.name = i18n(patch.nameEn, patch.nameNe);
  if (patch.sort !== undefined) data.sort = patch.sort;
  return prisma.menuCategory.update({ where: { id: categoryId }, data });
}

export async function deleteCategory(ctx: TenantContext, categoryId: string) {
  const cat = await prisma.menuCategory.findUnique({ where: { id: categoryId } });
  assertTenant(ctx, cat);
  await prisma.menuCategory.delete({ where: { id: categoryId } });
  return { ok: true };
}

export async function addModifier(
  ctx: TenantContext,
  itemId: string,
  input: { groupName: string; nameEn: string; nameNe?: string; priceDeltaMinor: number },
) {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  assertTenant(ctx, item);
  return prisma.modifier.create({
    data: {
      menuItemId: itemId,
      groupName: input.groupName,
      name: i18n(input.nameEn, input.nameNe),
      priceDeltaMinor: input.priceDeltaMinor,
    },
  });
}

export async function deleteModifier(ctx: TenantContext, modifierId: string) {
  const modifier = await prisma.modifier.findUnique({ where: { id: modifierId }, include: { menuItem: true } });
  if (!modifier) return { ok: true };
  assertTenant(ctx, modifier.menuItem);
  await prisma.modifier.delete({ where: { id: modifierId } });
  return { ok: true };
}
