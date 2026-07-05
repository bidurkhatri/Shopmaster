/** i18n text stored as JSON in a String column (SQLite) — helpers to read it safely. LOC-01/MENU-02. */
import type { Locale } from "./constants.js";

export interface I18nText {
  en: string;
  ne?: string;
}

export function parseI18n(raw: string | I18nText | null | undefined): I18nText {
  if (raw == null) return { en: "" };
  if (typeof raw !== "string") return raw;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && "en" in v) return v as I18nText;
    return { en: String(raw) };
  } catch {
    return { en: raw };
  }
}

/** Pick the best string for a locale, falling back to English. */
export function pickText(raw: string | I18nText | null | undefined, locale: Locale): string {
  const v = parseI18n(raw);
  return (locale === "ne" ? v.ne : v.en) || v.en || "";
}

export function i18n(en: string, ne?: string): string {
  return JSON.stringify({ en, ...(ne ? { ne } : {}) });
}
