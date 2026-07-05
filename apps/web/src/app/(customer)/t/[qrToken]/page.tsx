"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { StorefrontOrdering, StorefrontSkeleton } from "@/components/StorefrontOrdering";
import { EmptyState } from "@/components/ui";
import { IconStore } from "@/components/icons";
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

  if (error)
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState icon={<IconStore className="h-6 w-6" />} title="Table not found" description="This QR code isn't active. Please ask a staff member for help." />
      </div>
    );
  if (!data) return <StorefrontSkeleton mode="qr" />;

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
