/**
 * THE financial engine — single source of truth for pricing/commission/
 * capacity assumptions. Step 2 of the holistic rebuild (see workspace doc
 * 2026-07-07-financial-system-audit.md).
 *
 * Pure + client-safe (no DB imports). `DEFAULT_ENGINE_CONFIG` mirrors the
 * legacy hardcoded values in lib/pricing/data.ts exactly, so behavior is
 * unchanged until the DB-backed loader (lib/engine/load.ts) supplies real
 * config from fin_ tables. Every module that needs waste %, labor rates,
 * commission tiers, mileage, or capacity math calls THESE helpers — no module
 * re-derives its own copy (that drift is what this engine exists to kill).
 */
import {
  PricingData,
  type PricingDataT,
  type CommissionTier,
} from "@/lib/pricing/data";

export type LaborModel = "subcontract" | "burdened";
export type OverheadMode = "live" | "pinned";

export type MileageBand = {
  minMiles: number;
  /** null = uncapped. Matching is half-open: [minMiles, maxMiles). */
  maxMiles: number | null;
  flatCost: number;
  costPerMile: number;
  label?: string | null;
};

export type CapacityConfig = {
  /** 0 = not configured (ownership inputs in settings). */
  crewCount: number;
  /** 0 = not configured. */
  sqftPerCrewDay: number;
  workDaysPerWeek: number;
};

export type WasteConfig = {
  standardPct: number;
  puttingGreenPct: number;
};

export type EngineConfig = {
  /** Product costs, labor defaults, tearout tiers, commission tiers, material
   * constants — the exact shape calculateQuote() consumes. */
  pricing: PricingDataT;
  waste: WasteConfig;
  laborModel: LaborModel;
  overhead: { mode: OverheadMode; pinnedRate: number };
  mileageBands: MileageBand[];
  capacity: CapacityConfig;
  smallJobSqftThreshold: number;
  /** Config fields that silently fell back to code defaults because DB rows
   * were missing. Surfaced in admin settings — never swallowed. */
  warnings: string[];
};

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  pricing: PricingData,
  waste: { standardPct: 10, puttingGreenPct: 20 },
  laborModel: "subcontract",
  overhead: { mode: "live", pinnedRate: 0 },
  mileageBands: [],
  capacity: { crewCount: 0, sqftPerCrewDay: 0, workDaysPerWeek: 5 },
  smallJobSqftThreshold: 600,
  warnings: [],
};

/* ── Waste — ONE implementation (was drifted: calculator UI knew about the
      20% putting-green rule, the pitch adapters hardcoded 10% for everything,
      silently under-wasting greens quoted through the deck). ─────────────── */
export function wasteFor(productName: string, config: EngineConfig = DEFAULT_ENGINE_CONFIG): number {
  const turf = config.pricing.TURF_PRODUCTS[productName];
  if (turf?.category === "putting_green") return config.waste.puttingGreenPct;
  return config.waste.standardPct;
}

/* ── Labor rate — ONE implementation (was drifted: the pitch adapters missed
      the putting-green check, under-pricing green labor by ~$0.40/sqft). ─── */
export function laborRateFor(
  args: { application: "soil" | "concrete"; installedSqft: number; product?: string },
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  const L = config.pricing.LABOR_DEFAULTS;
  const turf = args.product ? config.pricing.TURF_PRODUCTS[args.product] : undefined;
  if (turf?.category === "putting_green") return L.putting_green.rate;
  if (args.application === "concrete") return L.concrete.rate;
  if (args.installedSqft > 0 && args.installedSqft < config.smallJobSqftThreshold) {
    return L.soil_small.rate;
  }
  return L.soil_standard.rate;
}

/* ── Commission — rate determined from GP%, paid on gross-margin dollars.
      Tiers are half-open [min, max) with null = uncapped, so there is no dead
      zone between bands (the old 49.99 gap paid 0%). ─────────────────────── */
export function commissionFor(
  marginPct: number,
  tiers: CommissionTier[] = DEFAULT_ENGINE_CONFIG.pricing.COMMISSION_TIERS,
): { rate: number; tier: CommissionTier | null } {
  for (const tier of tiers) {
    if (marginPct >= tier.minMargin && (tier.maxMargin === null || marginPct < tier.maxMargin)) {
      return { rate: tier.rate, tier };
    }
  }
  return { rate: 0, tier: null };
}

/** The next tier above the current margin that pays a better rate — powers the
 * "raise price to hit next tier" hint. Derived from config, never hardcoded. */
export function nextCommissionTier(
  marginPct: number,
  tiers: CommissionTier[] = DEFAULT_ENGINE_CONFIG.pricing.COMMISSION_TIERS,
): CommissionTier | null {
  const { rate } = commissionFor(marginPct, tiers);
  const candidates = tiers
    .filter((t) => t.minMargin > marginPct && t.rate > rate && !t.requiresReview)
    .sort((a, b) => a.minMargin - b.minMargin);
  return candidates[0] ?? null;
}

/* ── Mileage — bands are admin-configured (seeded empty; ownership inputs).
      No band matched = $0 with band:null so callers can surface "unpriced". ── */
export function mileageCostFor(
  miles: number,
  bands: MileageBand[],
): { cost: number; band: MileageBand | null } {
  for (const band of [...bands].sort((a, b) => a.minMiles - b.minMiles)) {
    if (miles >= band.minMiles && (band.maxMiles === null || miles < band.maxMiles)) {
      return { cost: band.flatCost + band.costPerMile * miles, band };
    }
  }
  return { cost: 0, band: null };
}
