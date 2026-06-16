import { describe, it, expect } from "vitest";
import { suggestLaborRate, buildTierJob, toClientPrice } from "../pricing";
import { calculateQuote } from "@/lib/pricing/calculator";
import type { Tier, BaseJob } from "../types";

const baseJob: BaseJob = {
  installedSqft: 800,
  application: "soil",
  tearoutTier: "5",
  access: "normal",
};

const goldTier: Tier = {
  key: "gold", name: "Gold", sort: 2,
  productLabel: "Royal 40", pricingKey: "Royal 40",
  targetMargin: 50, infillMode: "standard",
  inclusions: ["Realistic blade"],
  warranty: { residential_years: 15, commercial_years: 8, prorated: true },
};

describe("suggestLaborRate", () => {
  it("uses the small-job rate under 600 sqft of soil", () => {
    expect(suggestLaborRate("soil", 500)).toBe(1.9);
  });
  it("uses the standard rate at 600+ sqft of soil", () => {
    expect(suggestLaborRate("soil", 800)).toBe(1.6);
  });
  it("uses the concrete rate for concrete", () => {
    expect(suggestLaborRate("concrete", 800)).toBe(1.1);
  });
});

describe("buildTierJob", () => {
  it("maps tier + base job onto a calculator Job", () => {
    const job = buildTierJob(baseJob, goldTier);
    expect(job.product).toBe("Royal 40");
    expect(job.installedSqft).toBe(800);
    expect(job.application).toBe("soil");
    expect(job.targetMargin).toBe(50);
    expect(job.laborRate).toBe(1.6);
  });
});

describe("toClientPrice", () => {
  it("returns only client-safe keys — never COGS/margin/commission", () => {
    const job = buildTierJob(baseJob, goldTier);
    const quote = calculateQuote(job);
    const price = toClientPrice(quote, goldTier);

    expect(new Set(Object.keys(price))).toEqual(
      new Set(["tier", "name", "productLabel", "total", "perSqft", "reviewRequired", "inclusions", "warranty"]),
    );
    const serialized = JSON.stringify(price);
    for (const banned of ["cogs", "commission", "companyNet", "grossProfit", "commissionRate", "reviewFlags", "lines"]) {
      expect(serialized).not.toContain(banned);
    }
  });

  it("carries the real computed price for a valid job", () => {
    const job = buildTierJob(baseJob, goldTier);
    const quote = calculateQuote(job);
    const price = toClientPrice(quote, goldTier);
    expect(price.reviewRequired).toBe(false);
    expect(price.total).toBe(quote.price);
    expect(price.total).toBeGreaterThan(0);
  });

  it("flags reviewRequired with a null total for an unknown product", () => {
    const badTier: Tier = { ...goldTier, pricingKey: "NotARealProduct" };
    const quote = calculateQuote(buildTierJob(baseJob, badTier));
    const price = toClientPrice(quote, badTier);
    expect(price.reviewRequired).toBe(true);
    expect(price.total).toBeNull();
  });
});
