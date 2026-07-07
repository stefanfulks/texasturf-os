/**
 * DB-backed engine config loader. Server-only (queries Supabase).
 *
 * Reads the admin-editable config tables and composes an EngineConfig for the
 * quote flow. Every field falls back to DEFAULT_ENGINE_CONFIG *per source*
 * with an entry in `warnings[]` — a missing table degrades loudly to today's
 * seeded values, never silently to something else.
 *
 * RLS: fin_product / fin_cost_rate / fin_commission_tier / fin_mileage_band
 * are team-readable (quotes run for sales + office). fin_company_settings is
 * admin-only — for non-admin viewers that query returns no rows and the
 * capacity/mode knobs fall back to defaults, which is correct: those knobs
 * only power admin surfaces (Goals engine, settings).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type {
  FinCommissionTier,
  FinCostRate,
  FinMileageBand,
  FinProductRow,
} from "@/lib/db-helpers.types";
import {
  PricingData,
  type CommissionTier,
  type TurfProduct,
} from "@/lib/pricing/data";
import {
  DEFAULT_ENGINE_CONFIG,
  type EngineConfig,
  type MileageBand,
} from "./config";

type SettingsRow = {
  labor_model: string;
  overhead_mode: string;
  overhead_pinned_rate: number;
  crew_count: number;
  sqft_per_crew_day: number;
  work_days_per_week: number;
};

export type EngineConfigRows = {
  products: FinProductRow[];
  costRates: FinCostRate[];
  commissionTiers: FinCommissionTier[];
  mileageBands: FinMileageBand[];
  settings: SettingsRow | null;
};

function rateMap(rows: FinCostRate[]): Map<string, number> {
  // Highest fiscal year wins per key.
  const byKey = new Map<string, FinCostRate>();
  for (const r of rows) {
    const prev = byKey.get(r.key);
    if (!prev || r.effective_fiscal_year > prev.effective_fiscal_year) byKey.set(r.key, r);
  }
  return new Map([...byKey.entries()].map(([k, r]) => [k, Number(r.value)]));
}

/** Pure composition — unit-testable without a DB. */
export function rowsToEngineConfig(rows: EngineConfigRows): EngineConfig {
  const warnings: string[] = [];
  const D = DEFAULT_ENGINE_CONFIG;

  // Products → TURF_PRODUCTS shape (historicalRange kept from code defaults by name).
  let turfProducts = D.pricing.TURF_PRODUCTS;
  if (rows.products.length > 0) {
    const mapped: Record<string, TurfProduct> = {};
    for (const p of rows.products) {
      mapped[p.name] = {
        cost: Number(p.raw_cost_per_sqft),
        category: p.category === "putting_green" ? "putting_green" : "landscape",
        infillType:
          p.infill_type === "agl" || p.infill_type === "sand_only" ? p.infill_type : "standard",
        rollSize: p.roll_size ?? "",
        historicalRange: D.pricing.TURF_PRODUCTS[p.name]?.historicalRange ?? null,
      };
    }
    turfProducts = mapped;
  } else {
    warnings.push("fin_product empty — using code-default product costs");
  }

  const rates = rateMap(rows.costRates);
  const rate = (key: string, fallback: number): number => {
    const v = rates.get(key);
    if (v === undefined) {
      warnings.push(`fin_cost_rate missing '${key}' — using code default ${fallback}`);
      return fallback;
    }
    return v;
  };

  const laborDefaults = {
    soil_standard: { ...D.pricing.LABOR_DEFAULTS.soil_standard, rate: rate("labor_soil_standard_per_sqft", D.pricing.LABOR_DEFAULTS.soil_standard.rate) },
    soil_small:    { ...D.pricing.LABOR_DEFAULTS.soil_small,    rate: rate("labor_soil_small_per_sqft",    D.pricing.LABOR_DEFAULTS.soil_small.rate) },
    putting_green: { ...D.pricing.LABOR_DEFAULTS.putting_green, rate: rate("labor_putting_green_per_sqft", D.pricing.LABOR_DEFAULTS.putting_green.rate) },
    concrete:      { ...D.pricing.LABOR_DEFAULTS.concrete,      rate: rate("labor_concrete_per_sqft",      D.pricing.LABOR_DEFAULTS.concrete.rate) },
  };

  let commissionTiers: CommissionTier[] = D.pricing.COMMISSION_TIERS;
  if (rows.commissionTiers.length > 0) {
    commissionTiers = [...rows.commissionTiers]
      .sort((a, b) => a.sort_order - b.sort_order || Number(a.min_margin_pct) - Number(b.min_margin_pct))
      .map((t) => ({
        minMargin: Number(t.min_margin_pct),
        maxMargin: t.max_margin_pct === null ? null : Number(t.max_margin_pct),
        rate: Number(t.rate_pct) / 100,
        label: t.label ?? `${Number(t.rate_pct)}% of GP`,
        requiresReview: t.requires_review,
      }));
  } else {
    warnings.push("fin_commission_tier empty — using code-default tiers");
  }

  const mileageBands: MileageBand[] = rows.mileageBands.map((b) => ({
    minMiles: Number(b.min_miles),
    maxMiles: b.max_miles === null ? null : Number(b.max_miles),
    flatCost: Number(b.flat_cost),
    costPerMile: Number(b.cost_per_mile),
    label: b.label,
  }));

  const minMargin = rate("min_margin_for_quote_pct", D.pricing.CALCULATION_CONSTANTS.MIN_MARGIN_FOR_QUOTE);

  const s = rows.settings;
  if (!s) warnings.push("fin_company_settings unavailable — capacity/mode knobs at defaults");

  return {
    pricing: {
      ...PricingData,
      TURF_PRODUCTS: turfProducts,
      LABOR_DEFAULTS: laborDefaults,
      COMMISSION_TIERS: commissionTiers,
      CALCULATION_CONSTANTS: {
        ...D.pricing.CALCULATION_CONSTANTS,
        MIN_MARGIN_FOR_QUOTE: minMargin,
      },
    },
    waste: {
      standardPct: rate("waste_standard_pct", D.waste.standardPct),
      puttingGreenPct: rate("waste_putting_green_pct", D.waste.puttingGreenPct),
    },
    laborModel: s?.labor_model === "burdened" ? "burdened" : "subcontract",
    overhead: {
      mode: s?.overhead_mode === "pinned" ? "pinned" : "live",
      pinnedRate: Number(s?.overhead_pinned_rate ?? 0),
    },
    mileageBands,
    capacity: {
      crewCount: Number(s?.crew_count ?? 0),
      sqftPerCrewDay: Number(s?.sqft_per_crew_day ?? 0),
      workDaysPerWeek: Number(s?.work_days_per_week ?? D.capacity.workDaysPerWeek),
    },
    smallJobSqftThreshold: rate("small_job_sqft_threshold", D.smallJobSqftThreshold),
    warnings,
  };
}

/** Load the engine config for the current user (RLS applies). */
export async function loadEngineConfig(
  supabase: SupabaseClient<Database>,
): Promise<EngineConfig> {
  const [productsRes, ratesRes, tiersRes, bandsRes, settingsRes] = await Promise.all([
    supabase.from("fin_product").select("*"),
    supabase.from("fin_cost_rate").select("*"),
    supabase.from("fin_commission_tier").select("*"),
    supabase.from("fin_mileage_band").select("*"),
    supabase
      .from("fin_company_settings")
      .select("labor_model, overhead_mode, overhead_pinned_rate, crew_count, sqft_per_crew_day, work_days_per_week")
      .order("fiscal_year", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return rowsToEngineConfig({
    products: productsRes.data ?? [],
    costRates: ratesRes.data ?? [],
    commissionTiers: tiersRes.data ?? [],
    mileageBands: bandsRes.data ?? [],
    settings: (settingsRes.data as SettingsRow | null) ?? null,
  });
}
