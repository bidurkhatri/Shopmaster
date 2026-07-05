/**
 * Shift / cash-drawer reconciliation (POS-07). A cashier opens a shift with a starting float, takes
 * cash through the session, then closes it by counting the drawer. We compute the *expected* cash
 * (opening float + cash sales − cash refunds during the session) and record the variance against the
 * counted amount, so an over/short is visible and auditable.
 *
 * "Cash sales" counts every cash payment that was captured during the window (status CAPTURED *or*
 * REFUNDED — the money physically entered the drawer); "cash refunds" counts the ones later paid back
 * out. So a captured-then-refunded cash sale nets to zero in the expected total, as it should.
 */
import { prisma } from "@shopmaster/db";
import type { ShiftDTO } from "@shopmaster/shared";
import { assertTenant, type TenantContext } from "./tenancy.js";

async function resolveLocationId(ctx: TenantContext, locationId?: string): Promise<string> {
  if (locationId) return locationId;
  const loc = await prisma.location.findFirst({ where: { organizationId: ctx.organizationId } });
  if (!loc) throw new Error("No location available for organization");
  return loc.id;
}

async function cashTotals(
  organizationId: string,
  locationId: string,
  from: Date,
  to: Date | null,
): Promise<{ cashSalesMinor: number; cashRefundsMinor: number }> {
  const createdAt = to ? { gte: from, lte: to } : { gte: from };
  const [sales, refunds] = await Promise.all([
    prisma.payment.aggregate({
      where: { organizationId, rail: "CASH", status: { in: ["CAPTURED", "REFUNDED"] }, createdAt, order: { locationId } },
      _sum: { amountMinor: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId, rail: "CASH", status: "REFUNDED", createdAt, order: { locationId } },
      _sum: { amountMinor: true },
    }),
  ]);
  return { cashSalesMinor: sales._sum.amountMinor ?? 0, cashRefundsMinor: refunds._sum.amountMinor ?? 0 };
}

type ShiftRow = Awaited<ReturnType<typeof prisma.shift.findFirst>> & object;

function baseDTO(s: NonNullable<ShiftRow>): ShiftDTO {
  return {
    id: s.id,
    locationId: s.locationId,
    openedByName: s.openedByName,
    status: s.status as "OPEN" | "CLOSED",
    openingFloatMinor: s.openingFloatMinor,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt ? s.closedAt.toISOString() : null,
    cashSalesMinor: s.cashSalesMinor,
    cashRefundsMinor: s.cashRefundsMinor,
    expectedCashMinor: s.expectedCashMinor,
    countedCashMinor: s.countedCashMinor,
    varianceMinor: s.varianceMinor,
    note: s.note,
  };
}

/** Overlay live drawer math onto an OPEN shift (its totals aren't snapshotted until close). */
function withLive(s: NonNullable<ShiftRow>, t: { cashSalesMinor: number; cashRefundsMinor: number }): ShiftDTO {
  return {
    ...baseDTO(s),
    cashSalesMinor: t.cashSalesMinor,
    cashRefundsMinor: t.cashRefundsMinor,
    expectedCashMinor: s.openingFloatMinor + t.cashSalesMinor - t.cashRefundsMinor,
  };
}

/** Open a drawer session. Only one shift may be open per location at a time. */
export async function openShift(ctx: TenantContext, input: { locationId?: string; openingFloatMinor: number }): Promise<ShiftDTO> {
  const locationId = await resolveLocationId(ctx, input.locationId);
  const existing = await prisma.shift.findFirst({ where: { organizationId: ctx.organizationId, locationId, status: "OPEN" } });
  if (existing) throw new Error("A shift is already open for this location");

  const staff = ctx.staffId ? await prisma.staffMember.findUnique({ where: { id: ctx.staffId } }) : null;
  const shift = await prisma.shift.create({
    data: {
      organizationId: ctx.organizationId,
      locationId,
      openedById: ctx.staffId ?? null,
      openedByName: staff?.name ?? null,
      openingFloatMinor: input.openingFloatMinor,
    },
  });
  return withLive(shift, { cashSalesMinor: 0, cashRefundsMinor: 0 });
}

/** The currently open shift for a location (with live drawer totals), or null. */
export async function getCurrentShift(ctx: TenantContext, locationId?: string): Promise<ShiftDTO | null> {
  const locId = await resolveLocationId(ctx, locationId);
  const shift = await prisma.shift.findFirst({ where: { organizationId: ctx.organizationId, locationId: locId, status: "OPEN" } });
  if (!shift) return null;
  const totals = await cashTotals(ctx.organizationId, locId, shift.openedAt, null);
  return withLive(shift, totals);
}

/** Close a shift: snapshot the expected cash, record the counted amount and the variance. */
export async function closeShift(ctx: TenantContext, shiftId: string, input: { countedCashMinor: number; note?: string }): Promise<ShiftDTO> {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  assertTenant(ctx, shift);
  if (shift!.status !== "OPEN") throw new Error("Shift is already closed");

  const closedAt = new Date();
  const totals = await cashTotals(ctx.organizationId, shift!.locationId, shift!.openedAt, closedAt);
  const expectedCashMinor = shift!.openingFloatMinor + totals.cashSalesMinor - totals.cashRefundsMinor;
  const varianceMinor = input.countedCashMinor - expectedCashMinor;

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      status: "CLOSED",
      closedAt,
      countedCashMinor: input.countedCashMinor,
      cashSalesMinor: totals.cashSalesMinor,
      cashRefundsMinor: totals.cashRefundsMinor,
      expectedCashMinor,
      varianceMinor,
      note: input.note ?? null,
    },
  });

  await prisma.auditLogEntry.create({
    data: {
      organizationId: ctx.organizationId,
      actorId: ctx.staffId ?? null,
      action: "SHIFT_CLOSED",
      target: `shift:${shiftId}`,
      after: JSON.stringify({ expectedCashMinor, countedCashMinor: input.countedCashMinor, varianceMinor }),
    },
  });

  return baseDTO(updated);
}

/** Recent shifts for the tenant; open ones carry live totals, closed ones their snapshot. */
export async function listShifts(ctx: TenantContext, limit = 30): Promise<ShiftDTO[]> {
  const shifts = await prisma.shift.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { openedAt: "desc" },
    take: limit,
  });
  const out: ShiftDTO[] = [];
  for (const s of shifts) {
    if (s.status === "OPEN") {
      const t = await cashTotals(ctx.organizationId, s.locationId, s.openedAt, null);
      out.push(withLive(s, t));
    } else {
      out.push(baseDTO(s));
    }
  }
  return out;
}
