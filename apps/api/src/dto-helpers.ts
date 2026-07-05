import { prisma } from "@shopmaster/db";
import { signSession } from "@shopmaster/core";
import {
  resolveCapabilities,
  permissionsFor,
  type OrganizationDTO,
  type AuthResponse,
  type SessionUser,
  type Tier,
  type BusinessType,
  type Currency,
  type Locale,
  type Role,
} from "@shopmaster/shared";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  tier: string;
  businessType: string;
  currency: string;
  locale: string;
  branding: string | null;
};

export function orgToDTO(org: OrgRow): OrganizationDTO {
  let branding: OrganizationDTO["branding"] = null;
  if (org.branding) {
    try {
      branding = JSON.parse(org.branding);
    } catch {
      branding = null;
    }
  }
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    tier: org.tier as Tier,
    businessType: org.businessType as BusinessType,
    currency: org.currency as Currency,
    locale: org.locale as Locale,
    branding,
  };
}

export async function buildAuthResponse(
  staff: { id: string; name: string; role: string; organizationId: string },
  org: OrgRow,
): Promise<AuthResponse> {
  const locations = await prisma.location.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  });
  const locationIds = locations.map((l) => l.id);
  const role = staff.role as Role;

  const token = await signSession({
    sub: staff.id,
    name: staff.name,
    role,
    organizationId: org.id,
    locationIds,
  });

  const user: SessionUser = {
    id: staff.id,
    name: staff.name,
    role,
    organizationId: org.id,
    locationIds,
    permissions: permissionsFor(role),
  };

  return {
    token,
    user,
    organization: orgToDTO(org),
    capabilities: resolveCapabilities(org.tier as Tier, org.businessType as BusinessType),
  };
}
