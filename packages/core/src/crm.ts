/**
 * Loyalty / CRM (CRM-01/02). Strictly opt-in: a CustomerProfile is created only when a customer
 * chooses to join rewards at checkout. Repeat visits attach to the same profile by contact method,
 * so visits, spend and points accrue over time. Loyalty stats are DERIVED from the customer's
 * completed orders — nothing to keep in sync, always consistent with the order log.
 */
import { prisma } from "@shopmaster/db";
import type { Channel, OrderStatus, CustomerDTO, CustomerDetailDTO, CustomerOrderDTO } from "@shopmaster/shared";
import { type TenantContext } from "./tenancy.js";

/** Orders that count as a "visit" for loyalty — anything that reached the kitchen or beyond. */
const COMPLETED_STATUSES = ["CONFIRMED", "READY", "CLOSED"];

/** 1 loyalty point per whole major currency unit spent (paisa/cents dropped). */
function pointsFor(spendMinor: number): number {
  return Math.floor(spendMinor / 100);
}

/**
 * Attach an order to a rewards customer (opt-in). Upserts the profile by contact method and links
 * the order to it. Idempotent: re-linking the same order/contact just refreshes name/opt-in.
 */
export async function upsertCustomerForOrder(
  ctx: TenantContext,
  input: { orderId: string; contactMethod: string; name?: string; optInMarketing?: boolean },
) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order || order.organizationId !== ctx.organizationId) return null;
  const contactMethod = input.contactMethod.trim();
  if (!contactMethod) return null;

  const profile = await prisma.customerProfile.upsert({
    where: { organizationId_contactMethod: { organizationId: ctx.organizationId, contactMethod } },
    create: {
      organizationId: ctx.organizationId,
      contactMethod,
      name: input.name?.trim() || null,
      optInMarketing: !!input.optInMarketing,
    },
    update: {
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      ...(input.optInMarketing ? { optInMarketing: true } : {}),
    },
  });

  await prisma.order.update({ where: { id: input.orderId }, data: { customerId: profile.id } });
  return profile;
}

function toStats(orders: { status: string; totalMinor: number; createdAt: Date }[]) {
  const completed = orders.filter((o) => COMPLETED_STATUSES.includes(o.status));
  const totalSpendMinor = completed.reduce((s, o) => s + o.totalMinor, 0);
  const lastVisit = completed.reduce<Date | null>((m, o) => (!m || o.createdAt > m ? o.createdAt : m), null);
  return {
    visits: completed.length,
    totalSpendMinor,
    points: pointsFor(totalSpendMinor),
    lastVisit: lastVisit ? lastVisit.toISOString() : null,
  };
}

/** All rewards customers for the tenant, ranked by spend (CRM-02). */
export async function listCustomers(ctx: TenantContext): Promise<CustomerDTO[]> {
  const customers = await prisma.customerProfile.findMany({
    where: { organizationId: ctx.organizationId },
    include: { orders: { select: { status: true, totalMinor: true, createdAt: true } } },
  });

  return customers
    .map((c) => ({
      id: c.id,
      name: c.name,
      contactMethod: c.contactMethod,
      optInMarketing: c.optInMarketing,
      ...toStats(c.orders),
      createdAt: c.createdAt.toISOString(),
    }))
    .sort((a, b) => b.totalSpendMinor - a.totalSpendMinor);
}

/** One customer with their recent order history (CRM-02). */
export async function getCustomer(ctx: TenantContext, id: string): Promise<CustomerDetailDTO | null> {
  const c = await prisma.customerProfile.findUnique({
    where: { id },
    include: { orders: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  // Return null (→ 404) rather than throwing on a cross-tenant id — probing resistance (GAP-05).
  if (!c || c.organizationId !== ctx.organizationId) return null;

  const orders: CustomerOrderDTO[] = c.orders.map((o) => ({
    id: o.id,
    channel: o.channel as Channel,
    status: o.status as OrderStatus,
    totalMinor: o.totalMinor,
    createdAt: o.createdAt.toISOString(),
  }));

  return {
    id: c.id,
    name: c.name,
    contactMethod: c.contactMethod,
    optInMarketing: c.optInMarketing,
    ...toStats(c.orders),
    createdAt: c.createdAt.toISOString(),
    orders,
  };
}
