"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { BrandStyle, Button, ThemeToggle, Spinner } from "@/components/ui";
import { IconCart, IconReceipt, IconChart } from "@/components/icons";
import { SyncIndicator } from "@/components/SyncIndicator";

const NAV = [
  { href: "/pos", label: "POS", icon: IconCart },
  { href: "/kitchen", label: "Kitchen", icon: IconReceipt },
  { href: "/admin", label: "Admin", icon: IconChart },
];

function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function StaffShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { token, user, organization, logout } = useAuth();

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  if (!hydrated || !token || !organization) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-bg text-muted">
        <Spinner />
        <span className="text-sm font-medium">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <BrandStyle primary={organization.branding?.primaryColor} accent={organization.branding?.accentColor} />
      <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <Link href="/pos" className="tap flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white shadow-soft">
              {initialsOf(organization.name)}
            </span>
            <span className="hidden max-w-[12rem] truncate font-semibold text-ink sm:inline">{organization.name}</span>
          </Link>

          <nav className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`tap flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium sm:px-3 ${
                    active ? "bg-brand text-white shadow-soft" : "text-muted hover:bg-surface hover:text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{n.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <SyncIndicator />
            <ThemeToggle />
            <div className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-1 sm:pr-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                {initialsOf(user?.name)}
              </span>
              <div className="hidden text-left leading-tight sm:block">
                <div className="text-sm font-medium text-ink">{user?.name}</div>
                <div className="text-xs capitalize text-muted">{user?.role}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="text-muted hover:text-rose-600"
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
    </div>
  );
}
