"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { StorefrontOrdering } from "@/components/StorefrontOrdering";
import type { MenuCategoryDTO, OrganizationDTO } from "@shopmaster/shared";

interface TableResponse {
  table: { id: string; label: string; qrToken: string };
  organization: OrganizationDTO;
  menu: MenuCategoryDTO[];
}

export default function TableOrderPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [data, setData] = useState<TableResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<TableResponse>(`/tables/${qrToken}`, false)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [qrToken]);

  if (error) return <Centered>Table not found.</Centered>;
  if (!data) return <Centered>Loading menu…</Centered>;

  return (
    <StorefrontOrdering
      org={data.organization}
      menu={data.menu}
      mode="qr"
      qrToken={data.table.qrToken}
      tableLabel={data.table.label}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-slate-400">{children}</div>;
}
