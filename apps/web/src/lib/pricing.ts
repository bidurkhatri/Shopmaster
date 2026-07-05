/**
 * Client-side mirror of @shopmaster/core pricing-tax, for instant optimistic totals in the POS
 * before the server round-trip (FE-03). Kept intentionally tiny; the server remains authoritative.
 */
export interface CartLine {
  unitPriceMinor: number;
  qty: number;
  modifiers?: { priceDeltaMinor: number }[];
}

export function lineTotal(l: CartLine): number {
  const mods = (l.modifiers ?? []).reduce((s, m) => s + m.priceDeltaMinor, 0);
  return (l.unitPriceMinor + mods) * l.qty;
}

export function totals(lines: CartLine[], taxRateBps: number, inclusive: boolean) {
  const subtotalMinor = lines.reduce((s, l) => s + lineTotal(l), 0);
  const rate = taxRateBps / 10_000;
  if (inclusive) {
    const net = Math.round(subtotalMinor / (1 + rate));
    return { subtotalMinor, taxMinor: subtotalMinor - net, totalMinor: subtotalMinor };
  }
  const taxMinor = Math.round(subtotalMinor * rate);
  return { subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor };
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
