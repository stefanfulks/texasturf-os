import { describe, it, expect } from "vitest";
import { compareQuoteWithOverhead } from "@/lib/finance/overhead-compare";
import type { QuoteResult } from "@/lib/pricing/calculator";

const quote: QuoteResult = {
  lines: [], cogs: 1000, price: 2000, grossProfit: 1000,
  commissionRate: 0.06, commission: 60, companyNet: 940,
  reviewFlags: [], nextTier: null, pricePerSqft: null,
};

describe("compareQuoteWithOverhead", () => {
  it("loads overhead onto COGS and reprices at the same margin", () => {
    const r = compareQuoteWithOverhead(quote, 0.5264, 50);
    expect(r.currentPrice).toBe(2000);
    expect(r.loadedCost).toBeCloseTo(1000 * 1.5264, 2);
    expect(r.overheadAmount).toBeCloseTo(526.4, 2);
    expect(r.priceAtSameMargin).toBeCloseTo(1526.4 / (1 - 0.5), 2);
  });
  it("shows the margin actually realized if the current price is held", () => {
    const r = compareQuoteWithOverhead(quote, 0.5264, 50);
    expect(r.marginIfPriceHeld).toBeCloseTo(0.2368, 4);
  });
  it("handles a review-flagged quote with null price", () => {
    const r = compareQuoteWithOverhead({ ...quote, price: null }, 0.5264, 50);
    expect(r.currentPrice).toBeNull();
    expect(r.priceAtSameMargin).toBeCloseTo(1526.4 / 0.5, 2);
    expect(r.marginIfPriceHeld).toBeNull();
  });
});
