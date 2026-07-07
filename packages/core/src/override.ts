/**
 * Manager-authorization overrides (POS-05 / POS-11). Some actions — large discounts, voids — must be
 * blessed by someone who holds the permission, even if the person at the terminal doesn't. This finds
 * an active staff member in the same tenant whose PIN matches AND who actually holds the required
 * permission, so a cashier can get a manager's approval at the terminal without switching sessions.
 */
import { prisma } from "@shopmaster/db";
import { permissionsFor, type Permission, type Role } from "@shopmaster/shared";
import { verifyPin } from "./auth.js";

export interface OverrideApproval {
  staffId: string;
  name: string;
  role: Role;
}

/** Return the approving staff member for `permission` if `pin` matches one who holds it, else null. */
export async function authorizeOverride(organizationId: string, pin: string, permission: Permission): Promise<OverrideApproval | null> {
  const staff = await prisma.staffMember.findMany({ where: { organizationId, active: true } });
  for (const s of staff) {
    const role = s.role as Role;
    if (!permissionsFor(role).includes(permission)) continue;
    if (verifyPin(pin, s.pinHash)) return { staffId: s.id, name: s.name, role };
  }
  return null;
}
