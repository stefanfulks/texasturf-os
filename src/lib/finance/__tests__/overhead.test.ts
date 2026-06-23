import { describe, it, expect } from "vitest";
import { computeOverhead, priceJob } from "@/lib/finance/overhead";

// Generic figures (repo is public). Real-workbook validation lives in the
// private plan docs; here we prove the formulas with non-identifying numbers.
describe("computeOverhead", () => {
  it("derives the prime-cost absorption rate (indirect / direct)", () => {
    const r = computeOverhead({ totalDirect: 1000, totalIndirect: 600 });
    expect(r.absorptionRate).toBeCloseTo(0.6, 4);
    expect(r.breakEvenRevenue).toBeCloseTo(1600, 2);
  });
  it("returns 0 when there are no direct costs", () => {
    expect(computeOverhead({ totalDirect: 0, totalIndirect: 5000 }).absorptionRate).toBe(0);
  });
});

describe("priceJob", () => {
  it("loads overhead onto job cost and builds the margin ladder", () => {
    const r = priceJob({ material: 1000, burdenedLabor: 500, subcontract: 0, shipping: 100, absorptionRate: 0.6 });
    expect(r.actualCost).toBe(1600);
    expect(r.loadedBreakevenCost).toBeCloseTo(1600 * 1.6, 2); // 2560
    expect(r.priceLadder.map((p) => p.marginPct)).toEqual([2, 5, 7, 10, 15, 20]);
    const at20 = r.priceLadder.find((p) => p.marginPct === 20)!;
    expect(at20.price).toBeCloseTo((1600 * 1.6) / (1 - 0.2), 2); // 3200
  });
});
