import { describe, expect, it } from "vitest";
import { rowsToEngineConfig, type EngineConfigRows } from "@/lib/engine/load";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/engine/config";

const now = new Date(0).toISOString();

function costRate(key: string, value: number, fy = 2026) {
  return {
    id: key, key, value, unit: null, effective_fiscal_year: fy,
    created_at: now, updated_at: now,
  };
}

const FULL_ROWS: EngineConfigRows = {
  products: [
    {
      id: "p1", name: "TexasLush", sku: null, category: "landscape",
      raw_cost_per_sqft: 0.95, roll_size: "15x100", infill_type: "standard",
      linked_inv_product_id: null, created_at: now, updated_at: now,
    },
    {
      id: "p2", name: "TexasPutt (pro putt 44)", sku: null, category: "putting_green",
      raw_cost_per_sqft: 2.40, roll_size: "15x100", infill_type: "sand_only",
      linked_inv_product_id: null, created_at: now, updated_at: now,
    },
  ],
  costRates: [
    costRate("waste_standard_pct", 12),
    costRate("waste_putting_green_pct", 22),
    costRate("labor_soil_standard_per_sqft", 1.7),
    costRate("labor_soil_small_per_sqft", 2.0),
    costRate("labor_putting_green_per_sqft", 2.1),
    costRate("labor_concrete_per_sqft", 1.2),
    costRate("small_job_sqft_threshold", 500),
    costRate("min_margin_for_quote_pct", 45),
  ],
  commissionTiers: [
    { id: "t0", min_margin_pct: 0,  max_margin_pct: 40,   rate_pct: 0, requires_review: true,  label: "Review", sort_order: 0, created_at: now, updated_at: now },
    { id: "t1", min_margin_pct: 40, max_margin_pct: 50,   rate_pct: 4, requires_review: false, label: "4%",     sort_order: 1, created_at: now, updated_at: now },
    { id: "t2", min_margin_pct: 50, max_margin_pct: null, rate_pct: 7, requires_review: false, label: "7%",     sort_order: 2, created_at: now, updated_at: now },
  ],
  mileageBands: [
    { id: "m1", min_miles: 0, max_miles: 30, flat_cost: 0, cost_per_mile: 0, label: "local", sort_order: 0, created_at: now, updated_at: now },
    { id: "m2", min_miles: 30, max_miles: null, flat_cost: 100, cost_per_mile: 1.25, label: "far", sort_order: 1, created_at: now, updated_at: now },
  ],
  settings: {
    labor_model: "subcontract", overhead_mode: "pinned", overhead_pinned_rate: 0.45,
    crew_count: 3, sqft_per_crew_day: 900, work_days_per_week: 5,
  },
};

describe("rowsToEngineConfig — DB rows compose the engine config", () => {
  it("maps every source with no warnings when data is complete", () => {
    const c = rowsToEngineConfig(FULL_ROWS);
    expect(c.warnings).toEqual([]);
    expect(c.pricing.TURF_PRODUCTS["TexasLush"].cost).toBe(0.95);
    expect(c.pricing.TURF_PRODUCTS["TexasPutt (pro putt 44)"].category).toBe("putting_green");
    expect(c.waste).toEqual({ standardPct: 12, puttingGreenPct: 22 });
    expect(c.pricing.LABOR_DEFAULTS.soil_standard.rate).toBe(1.7);
    expect(c.smallJobSqftThreshold).toBe(500);
    expect(c.pricing.CALCULATION_CONSTANTS.MIN_MARGIN_FOR_QUOTE).toBe(45);
    // rate_pct 7 → 0.07, half-open null cap
    expect(c.pricing.COMMISSION_TIERS[2]).toMatchObject({ minMargin: 50, maxMargin: null, rate: 0.07 });
    expect(c.mileageBands[1]).toMatchObject({ minMiles: 30, maxMiles: null, flatCost: 100 });
    expect(c.overhead).toEqual({ mode: "pinned", pinnedRate: 0.45 });
    expect(c.capacity).toEqual({ crewCount: 3, sqftPerCrewDay: 900, workDaysPerWeek: 5 });
  });

  it("empty rows fall back to code defaults, loudly", () => {
    const c = rowsToEngineConfig({
      products: [], costRates: [], commissionTiers: [], mileageBands: [], settings: null,
    });
    expect(c.pricing.TURF_PRODUCTS).toEqual(DEFAULT_ENGINE_CONFIG.pricing.TURF_PRODUCTS);
    expect(c.pricing.COMMISSION_TIERS).toEqual(DEFAULT_ENGINE_CONFIG.pricing.COMMISSION_TIERS);
    expect(c.waste).toEqual(DEFAULT_ENGINE_CONFIG.waste);
    expect(c.capacity.crewCount).toBe(0);
    // Every fallback is reported, never silent.
    expect(c.warnings.length).toBeGreaterThanOrEqual(10);
    expect(c.warnings.join(" ")).toContain("fin_product empty");
    expect(c.warnings.join(" ")).toContain("fin_commission_tier empty");
  });

  it("newer fiscal-year cost rates win over older ones", () => {
    const c = rowsToEngineConfig({
      ...FULL_ROWS,
      costRates: [costRate("waste_standard_pct", 10, 2025), costRate("waste_standard_pct", 15, 2027)],
    });
    expect(c.waste.standardPct).toBe(15);
  });
});
