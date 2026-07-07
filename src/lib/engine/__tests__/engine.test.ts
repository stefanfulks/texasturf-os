import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENGINE_CONFIG,
  commissionFor,
  laborRateFor,
  mileageCostFor,
  nextCommissionTier,
  wasteFor,
} from "@/lib/engine/config";
import { computeCapacity, installableAnnualRevenue } from "@/lib/engine/capacity";
import { calculateQuote } from "@/lib/pricing/calculator";
import { buildTierJob } from "@/lib/pitch/pricing";
import type { Tier } from "@/lib/pitch/types";

const GREEN = "TexasPutt (pro putt 44)";

function tier(overrides: Partial<Tier> = {}): Tier {
  return {
    key: "gold",
    name: "Gold",
    sort: 1,
    productLabel: "Gold turf",
    pricingKey: "Royal 40",
    targetMargin: 50,
    infillMode: "standard",
    inclusions: [],
    warranty: { residential_years: 15, commercial_years: 8, prorated: true },
    ...overrides,
  };
}

describe("wasteFor — one waste implementation", () => {
  it("standard products get the standard waste", () => {
    expect(wasteFor("Royal 40")).toBe(10);
  });
  it("putting greens get the premium waste (the pitch path used to hardcode 10%)", () => {
    expect(wasteFor(GREEN)).toBe(20);
  });
  it("unknown products fall back to standard", () => {
    expect(wasteFor("Nope")).toBe(10);
  });
});

describe("laborRateFor — one labor implementation", () => {
  it("soil ≥600 sqft → standard rate", () => {
    expect(laborRateFor({ application: "soil", installedSqft: 800 })).toBe(1.6);
  });
  it("soil <600 sqft → small-job rate", () => {
    expect(laborRateFor({ application: "soil", installedSqft: 400 })).toBe(1.9);
  });
  it("concrete → concrete rate", () => {
    expect(laborRateFor({ application: "concrete", installedSqft: 800 })).toBe(1.1);
  });
  it("putting green wins over application (the pitch path used to miss this)", () => {
    expect(laborRateFor({ application: "soil", installedSqft: 800, product: GREEN })).toBe(2.0);
  });
});

describe("buildTierJob — pitch adapter consumes the engine", () => {
  it("putting-green tiers now price with 20% waste and $2.00 labor", () => {
    const job = buildTierJob(
      { installedSqft: 800, application: "soil", tearoutTier: "1", access: "normal" },
      tier({ pricingKey: GREEN }),
    );
    expect(job.wastePct).toBe(20);
    expect(job.laborRate).toBe(2.0);
  });
  it("landscape tiers keep the legacy behavior exactly (10% / $1.60)", () => {
    const job = buildTierJob(
      { installedSqft: 800, application: "soil", tearoutTier: "1", access: "normal" },
      tier(),
    );
    expect(job.wastePct).toBe(10);
    expect(job.laborRate).toBe(1.6);
  });
});

describe("commissionFor — half-open tiers, no dead zones", () => {
  const tiers = DEFAULT_ENGINE_CONFIG.pricing.COMMISSION_TIERS;
  it("matches the legacy bands", () => {
    expect(commissionFor(45, tiers).rate).toBe(0.04);
    expect(commissionFor(50, tiers).rate).toBe(0.06);
    expect(commissionFor(60, tiers).rate).toBe(0.08);
    expect(commissionFor(85, tiers).rate).toBe(0.08);
  });
  it("fixes the 49.995% dead zone (legacy inclusive bands paid 0%)", () => {
    expect(commissionFor(49.995, tiers).rate).toBe(0.04);
  });
  it("below the floor → review tier, 0%", () => {
    const r = commissionFor(35, tiers);
    expect(r.rate).toBe(0);
    expect(r.tier?.requiresReview).toBe(true);
  });
});

describe("nextCommissionTier — hint derived from config, not hardcoded", () => {
  const tiers = DEFAULT_ENGINE_CONFIG.pricing.COMMISSION_TIERS;
  it("45% → next is the 50% tier", () => {
    expect(nextCommissionTier(45, tiers)?.minMargin).toBe(50);
  });
  it("55% → next is the 60% tier", () => {
    expect(nextCommissionTier(55, tiers)?.minMargin).toBe(60);
  });
  it("65% → no better tier", () => {
    expect(nextCommissionTier(65, tiers)).toBeNull();
  });
});

describe("calculateQuote — parity with legacy behavior", () => {
  const baseJob = {
    product: "Royal 40",
    installedSqft: 800,
    wastePct: 10,
    application: "soil" as const,
    tearoutTier: "5",
    access: "normal" as const,
    infillProduct: "Sand",
    edgings: [{ type: "Wonder Edge Black", lf: 60 }],
    nailerLF: 0,
    nailerType: "standard" as const,
    glueMode: "perimeter" as const,
    glueLF: 0,
    seamTapeLF: 0,
    laborRate: 1.6,
    extras: [],
    targetMargin: 55,
  };
  it("commission + next-tier hint match the legacy hardcoded outputs", () => {
    const q = calculateQuote(baseJob);
    expect(q.commissionRate).toBe(0.06);
    expect(q.nextTier?.marginTarget).toBe(60);
    expect(q.nextTier?.newRate).toBe(0.08);
    expect(q.price).not.toBeNull();
    // price = cogs / (1 - 0.55)
    expect(q.price!).toBeCloseTo(q.cogs / 0.45, 6);
  });
  it("margin 45 hints at the 50 tier", () => {
    const q = calculateQuote({ ...baseJob, targetMargin: 45 });
    expect(q.commissionRate).toBe(0.04);
    expect(q.nextTier?.marginTarget).toBe(50);
    expect(q.nextTier?.newRate).toBe(0.06);
  });
});

describe("mileageCostFor — bands are config, empty = unpriced", () => {
  it("no bands configured → $0 and band:null (callers surface 'unpriced')", () => {
    expect(mileageCostFor(25, [])).toEqual({ cost: 0, band: null });
  });
  it("matches half-open bands and applies flat + per-mile", () => {
    const bands = [
      { minMiles: 0, maxMiles: 20, flatCost: 0, costPerMile: 0 },
      { minMiles: 20, maxMiles: 50, flatCost: 50, costPerMile: 1.5 },
      { minMiles: 50, maxMiles: null, flatCost: 150, costPerMile: 2 },
    ];
    expect(mileageCostFor(10, bands).cost).toBe(0);
    expect(mileageCostFor(20, bands).cost).toBe(50 + 30);
    expect(mileageCostFor(60, bands).cost).toBe(150 + 120);
  });
});

describe("computeCapacity — the app's first capacity model", () => {
  it("unconfigured (0s) → configured:false, zero capacity", () => {
    const c = computeCapacity({ crewCount: 0, sqftPerCrewDay: 0, workDaysPerWeek: 5 });
    expect(c.configured).toBe(false);
    expect(c.sqftPerWeek).toBe(0);
    expect(installableAnnualRevenue(c, 8)).toBeNull();
  });
  it("3 crews × 900 sqft/day × 5 days = 13,500 sqft/week", () => {
    const c = computeCapacity({ crewCount: 3, sqftPerCrewDay: 900, workDaysPerWeek: 5 });
    expect(c.configured).toBe(true);
    expect(c.sqftPerWeek).toBe(13_500);
    expect(c.sqftPerYear).toBe(13_500 * 50);
    // At $8/sqft realized, annual installable revenue:
    expect(installableAnnualRevenue(c, 8)).toBe(13_500 * 50 * 8);
  });
});
