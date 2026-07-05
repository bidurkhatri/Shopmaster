"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { StorefrontOrdering } from "@/components/StorefrontOrdering";
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

  if (error) return <Centered>Store not found.</Centered>;
  if (!org || !menu) return <Centered>Loading store…</Centered>;

  return <StorefrontOrdering org={org} menu={menu} mode="online" />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-slate-400">{children}</div>;
}
