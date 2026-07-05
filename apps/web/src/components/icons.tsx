/** Inline stroke icons (currentColor) — no external icon dependency (CSP/offline safe). */
import type { ReactNode } from "react";

type P = { className?: string };

function S({ className, children }: P & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconMinus = (p: P) => <S {...p}><path d="M5 12h14" /></S>;
export const IconClose = (p: P) => <S {...p}><path d="M18 6 6 18M6 6l12 12" /></S>;
export const IconCheck = (p: P) => <S {...p}><path d="M20 6 9 17l-5-5" /></S>;
export const IconTrash = (p: P) => <S {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></S>;
export const IconEdit = (p: P) => <S {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></S>;
export const IconClock = (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>;
export const IconPrinter = (p: P) => <S {...p}><path d="M6 9V3h12v6M6 18H4v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5h-2M8 14h8v7H8z" /></S>;
export const IconArrowRight = (p: P) => <S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>;
export const IconChevronDown = (p: P) => <S {...p}><path d="m6 9 6 6 6-6" /></S>;
export const IconSearch = (p: P) => <S {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></S>;
export const IconSun = (p: P) => <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></S>;
export const IconMoon = (p: P) => <S {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></S>;
export const IconStore = (p: P) => <S {...p}><path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" /></S>;
export const IconReceipt = (p: P) => <S {...p}><path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1ZM9 8h6M9 12h6M9 16h4" /></S>;
export const IconCart = (p: P) => <S {...p}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L23 7H6" /></S>;
export const IconCash = (p: P) => <S {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></S>;
export const IconCard = (p: P) => <S {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></S>;
export const IconWifi = (p: P) => <S {...p}><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" /></S>;
export const IconWifiOff = (p: P) => <S {...p}><path d="m2 2 20 20M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4-2.6M19 12.5a10 10 0 0 0-6-2.9M12 19.5h.01" /></S>;
export const IconChart = (p: P) => <S {...p}><path d="M3 3v18h18M7 15v3M12 10v8M17 6v12" /></S>;
export const IconMenuList = (p: P) => <S {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></S>;
export const IconGrid = (p: P) => <S {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></S>;
export const IconUsers = (p: P) => <S {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 5.5a3.5 3.5 0 0 1 0 6.7M22 20a6 6 0 0 0-4-5.6" /></S>;
export const IconSettings = (p: P) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H2a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 3.4 6.6l-.1-.1A2 2 0 1 1 6.1 3.7l.1.1A1.6 1.6 0 0 0 8 4.9V4a2 2 0 1 1 4 0v.2A1.6 1.6 0 0 0 14.7 6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></S>;
export const IconDevice = (p: P) => <S {...p}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></S>;
export const IconBell = (p: P) => <S {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></S>;
export const IconSparkle = (p: P) => <S {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></S>;
export const IconBolt = (p: P) => <S {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></S>;
export const IconGlobe = (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></S>;
