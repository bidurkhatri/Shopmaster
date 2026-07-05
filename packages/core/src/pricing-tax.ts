/**
 * Pricing & Tax engine (LOC-02 / POS-10). Pure, no side effects, exhaustively unit-tested.
 *
 * Two jurisdictions, two behaviours:
 *   - Australia (AU_GST): GST is EXCLUSIVE — added on top of the listed price.
 *   - Nepal (NP_VAT): VAT is INCLUSIVE — already baked into the listed price.
 *
 * All amounts are integer minor units (cents / paisa). Currency itself never enters the maths —
 * it's a property of the adapter that runs (Payment-Integration §9).
 */

export interface TaxConfig {
  taxRateBps: number; // basis points; 1000 = 10%, 1300 = 13%
  taxInclusive: boolean;
}

export interface ModifierPrice {
  priceDeltaMinor: number;
}

export interface LineInput {
  unitPriceMinor: number;
  qty: number;
  modifiers?: ModifierPrice[];
  voided?: boolean;
}

export interface Totals {
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export function lineTotalMinor(line: LineInput): number {
  if (line.voided) return 0;
  const modSum = (line.modifiers ?? []).reduce((s, m) => s + m.priceDeltaMinor, 0);
  return (line.unitPriceMinor + modSum) * line.qty;
}

/** Split a (possibly tax-inclusive) subtotal into subtotal/tax/total. */
export function applyTax(subtotalMinor: number, cfg: TaxConfig): Totals {
  const rate = cfg.taxRateBps / 10_000;
  if (cfg.taxInclusive) {
    // Price already includes tax: back out the net, tax is the remainder, total == subtotal.
    const netMinor = Math.round(subtotalMinor / (1 + rate));
    return { subtotalMinor, taxMinor: subtotalMinor - netMinor, totalMinor: subtotalMinor };
  }
  // Tax added on top.
  const taxMinor = Math.round(subtotalMinor * rate);
  return { subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor };
}

export function computeTotals(lines: LineInput[], cfg: TaxConfig): Totals {
  const subtotalMinor = lines.reduce((s, l) => s + lineTotalMinor(l), 0);
  return applyTax(subtotalMinor, cfg);
}
