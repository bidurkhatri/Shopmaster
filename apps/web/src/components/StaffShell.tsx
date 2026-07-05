"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { BrandStyle } from "@/components/ui";
import { SyncIndicator } from "@/components/SyncIndicator";

const NAV = [
  { href: "/pos", label: "POS" },
  { href: "/kitchen", label: "Kitchen" },
  { href: "/admin", label: "Admin" },
];

export function StaffShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, organization, logout } = useAuth();

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  if (!token || !organization) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <BrandStyle primary={organization.branding?.primaryColor} accent={organization.branding?.accentColor} />
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
          <Link href="/pos" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white">S</span>
            <span className="hidden font-semibold text-slate-800 sm:inline">{organization.name}</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <SyncIndicator />
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-700">{user?.name}</div>
              <div className="text-xs text-slate-400">{user?.role}</div>
            </div>
            <button onClick={() => { logout(); router.replace("/login"); }} className="text-sm text-slate-400 hover:text-rose-600">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
    </div>
  );
}
