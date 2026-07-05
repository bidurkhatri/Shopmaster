"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { StorefrontOrdering, StorefrontSkeleton } from "@/components/StorefrontOrdering";
import { EmptyState } from "@/components/ui";
import { IconStore } from "@/components/icons";
import type { MenuCategoryDTO, OrganizationDTO } from "@shopmaster/shared";

export default function StorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const [org, setOrg] = useState<OrganizationDTO | null>(null);
  const [menu, setMenu] = useState<MenuCategoryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<OrganizationDTO>(`/orgs/${slug}`, false),
      api.get<MenuCategoryDTO[]>(`/orgs/${slug}/menu`, false),
    ])
      .then(([o, m]) => {
        setOrg(o);
        setMenu(m);
      })
      .catch((e) => setError((e as Error).message));
  }, [slug]);

  if (error)
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState icon={<IconStore className="h-6 w-6" />} title="Store not found" description="We couldn't find this store. Please check the link and try again." />
      </div>
    );
  if (!org || !menu) return <StorefrontSkeleton mode="online" />;

  return <StorefrontOrdering org={org} menu={menu} mode="online" />;
}
