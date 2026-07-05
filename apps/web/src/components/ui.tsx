"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { formatMoney, type Currency } from "@shopmaster/shared";
import { IconClose, IconChevronDown, IconSun, IconMoon } from "./icons";

/* ------------------------------------------------------------------ money */

export function Money({ minor, currency }: { minor: number; currency: Currency | string }) {
  return <span className="tabular-nums">{formatMoney(minor, currency)}</span>;
}

/* ------------------------------------------------------------------ button */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = "primary", size = "md", loading, icon, className = "", children, disabled, ...props }: BtnProps) {
  const base =
    "tap inline-flex items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none";
  const variants: Record<string, string> = {
    primary: "bg-brand text-white shadow-soft hover:brightness-110",
    secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
    outline: "border border-brand text-brand hover:bg-brand/10",
    ghost: "text-ink/80 hover:bg-surface-2",
    danger: "bg-rose-600 text-white shadow-soft hover:brightness-110",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base",
  };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, icon, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: ReactNode }) {
  return (
    <button aria-label={label} title={label} className={`tap grid h-9 w-9 place-items-center rounded-lg text-ink/70 hover:bg-surface-2 ${className}`} {...props}>
      {icon}
    </button>
  );
}

/* ------------------------------------------------------------------ card */

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-line bg-surface shadow-soft ${className}`}>{children}</div>;
}

/* ------------------------------------------------------------------ badge */

const TONES: Record<string, string> = {
  slate: "bg-surface-2 text-muted",
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  brand: "bg-brand/15 text-brand",
};
export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

/* ------------------------------------------------------------------ inputs */

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-brand focus-visible:outline-none ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-brand focus-visible:outline-none ${props.className ?? ""}`}
    />
  );
}

export function Select({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full appearance-none rounded-xl border border-line bg-surface px-3 py-2.5 pr-9 text-ink focus:border-brand focus-visible:outline-none ${className}`}
      >
        {children}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-ink/80">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade sm:items-center" onClick={onClose}>
      <div className={`w-full ${width} animate-rise rounded-2xl border border-line bg-surface shadow-lift`} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h3 className="text-base font-bold text-ink">{title}</h3>
            <IconButton label="Close" icon={<IconClose className="h-5 w-5" />} onClick={onClose} />
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ skeleton / empty / stat */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>}
      <div className="font-semibold text-ink">{title}</div>
      {description && <div className="mt-1 max-w-sm text-sm text-muted">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------ brand + spinner */

export function BrandStyle({ primary, accent }: { primary?: string; accent?: string }) {
  const css = `:root{${primary ? `--brand:${primary};` : ""}${accent ? `--brand-accent:${accent};` : ""}}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export function Spinner({ className = "" }: { className?: string }) {
  return <div className={`h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current ${className}`} />;
}

/* ------------------------------------------------------------------ theme toggle */

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("shopmaster-theme");
    const isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("shopmaster-theme", next ? "dark" : "light");
  };
  return <IconButton label="Toggle theme" icon={dark ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />} onClick={toggle} />;
}

/* ------------------------------------------------------------------ toasts */

type Toast = { id: number; title: string; tone: "default" | "success" | "error" };
const ToastCtx = createContext<(t: { title: string; tone?: Toast["tone"]; duration?: number }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: { title: string; tone?: Toast["tone"]; duration?: number }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((cur) => [...cur, { id, title: t.title, tone: t.tone ?? "default" }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), t.duration ?? 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-rise rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-lift ${
              t.tone === "success" ? "bg-emerald-600" : t.tone === "error" ? "bg-rose-600" : "bg-slate-900"
            }`}
          >
            {t.title}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
