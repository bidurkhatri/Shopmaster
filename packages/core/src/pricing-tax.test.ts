import { describe, it, expect } from "vitest";
import { applyTax, computeTotals, lineTotalMinor } from "./pricing-tax.js";

const AU_GST = { taxRateBps: 1000, taxInclusive: false };
const NP_VAT = { taxRateBps: 1300, taxInclusive: true };

describe("lineTotalMinor", () => {
  it("multiplies unit price by qty", () => {
    expect(lineTotalMinor({ unitPriceMinor: 480, qty: 2 })).toBe(960);
  });
  it("adds modifier deltas before multiplying", () => {
    expect(
      lineTotalMinor({ unitPriceMinor: 2200, qty: 2, modifiers: [{ priceDeltaMinor: 300 }, { priceDeltaMinor: 150 }] }),
    ).toBe((2200 + 450) * 2);
  });
  it("counts a voided line as zero", () => {
    expect(lineTotalMinor({ unitPriceMinor: 999, qty: 3, voided: true })).toBe(0);
  });
});

describe("applyTax — Australia (GST exclusive)", () => {
  it("adds 10% on top", () => {
    expect(applyTax(1000, AU_GST)).toEqual({ subtotalMinor: 1000, taxMinor: 100, totalMinor: 1100 });
  });
  it("rounds tax to the nearest minor unit", () => {
    // 999 * 10% = 99.9 → 100
    expect(applyTax(999, AU_GST)).toEqual({ subtotalMinor: 999, taxMinor: 100, totalMinor: 1099 });
  });
});

describe("applyTax — Nepal (VAT inclusive)", () => {
  it("backs 13% out of an inclusive price", () => {
    // 1130 includes 13% VAT: net 1000, tax 130, total unchanged
    expect(applyTax(1130, NP_VAT)).toEqual({ subtotalMinor: 1130, taxMinor: 130, totalMinor: 1130 });
  });
  it("total equals subtotal for inclusive tax", () => {
    const r = applyTax(3000, NP_VAT);
    expect(r.totalMinor).toBe(3000);
    expect(r.subtotalMinor).toBe(3000);
    expect(r.taxMinor).toBe(3000 - Math.round(3000 / 1.13));
  });
});

describe("computeTotals", () => {
  it("sums lines then applies GST", () => {
    const r = computeTotals(
      [
        { unitPriceMinor: 480, qty: 2 }, // 960
        { unitPriceMinor: 1650, qty: 1 }, // 1650
      ],
      AU_GST,
    );
    expect(r.subtotalMinor).toBe(2610);
    expect(r.taxMinor).toBe(261);
    expect(r.totalMinor).toBe(2871);
  });
  it("ignores voided lines", () => {
    const r = computeTotals(
      [
        { unitPriceMinor: 1000, qty: 1 },
        { unitPriceMinor: 5000, qty: 1, voided: true },
      ],
      AU_GST,
    );
    expect(r.subtotalMinor).toBe(1000);
  });
});
