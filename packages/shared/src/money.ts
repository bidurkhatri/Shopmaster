/** Money is always an integer in the currency's minor units (paisa / cents). No floats, ever. */
import type { Currency } from "./constants.js";

const SYMBOLS: Record<string, string> = { AUD: "$", NPR: "रू " };

export function formatMoney(minor: number, currency: Currency | string): string {
  const major = minor / 100;
  const formatted = major.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = SYMBOLS[currency] ?? "";
  return `${symbol}${formatted}`;
}

/** Parse a major-unit string like "12.50" into integer minor units (1250). */
export function toMinor(major: number): number {
  return Math.round(major * 100);
}
