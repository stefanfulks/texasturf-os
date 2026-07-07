/**
 * TexasTurf Pricing Data
 * ----------------------
 * Single source of truth for all pricing rules. Ported from the standalone
 * pricing-tool (April 2026) — see /tmp/pricing-tool-inspect/pricing-tool/src/data.js.
 *
 * To update prices, edit this file only. Each map below corresponds 1:1 to a
 * future Supabase table when we move pricing data into the DB.
 */

export type TurfCategory  = "landscape" | "putting_green";
export type InfillType    = "standard" | "agl" | "sand_only";
export type RollSize      = string;

export type TurfProduct = {
  cost:             number;          // raw $/sqft delivered
  category:         TurfCategory;
  infillType:       InfillType;
  rollSize:         RollSize;
  /** Historical sale-price points (low, typical, high). Null if unknown. */
  historicalRange:  [number, number, number] | null;
};

export type InfillProduct = { costPerLb: number; label: string };
export type EdgingProduct = { materialPerLF: number; laborPerLF: number };
export type NailerOption  = { costPerLF: number; label: string };
export type TearoutTier   = { rate: number | "review"; description: string };
export type LaborDefault  = { rate: number; description: string };
/** Matching is half-open [minMargin, maxMargin); maxMargin null = uncapped.
 * (The old inclusive 40–49.99 bands left a dead zone at 49.995 that paid 0%.) */
export type CommissionTier = {
  minMargin: number;
  maxMargin: number | null;
  rate: number;
  label: string;
  requiresReview?: boolean;
};

export const TURF_PRODUCTS: Record<string, TurfProduct> = {
  "TexasMoss":               { cost: 1.32, category: "landscape",     infillType: "standard",  rollSize: "15x100", historicalRange: [4.29, 6.99, 8.15] },
  "TexasLush":               { cost: 0.89, category: "landscape",     infillType: "standard",  rollSize: "15x100", historicalRange: [5.00, 8.20, 10.00] },
  "TexasPlay":               { cost: 0.76, category: "landscape",     infillType: "standard",  rollSize: "15x100", historicalRange: [6.75, 7.00, 8.50] },
  "TexasHaven":              { cost: 0.75, category: "landscape",     infillType: "standard",  rollSize: "15x100", historicalRange: [6.25, 7.50, 10.50] },
  "Royal 40":                { cost: 2.15, category: "landscape",     infillType: "agl",       rollSize: "13x100", historicalRange: [7.72, 9.25, 10.00] },
  "Saratoga 40":             { cost: 2.18, category: "landscape",     infillType: "agl",       rollSize: "13x100", historicalRange: [6.50, 9.25, 10.40] },
  "Saratoga 60":             { cost: 2.53, category: "landscape",     infillType: "agl",       rollSize: "13x100", historicalRange: [8.21, 9.75, 12.00] },
  "Kent 44":                 { cost: 2.53, category: "landscape",     infillType: "agl",       rollSize: "13x100", historicalRange: [8.49, 9.75, 16.56] },
  "Monte Carlo 60":          { cost: 2.38, category: "landscape",     infillType: "agl",       rollSize: "13x100", historicalRange: null },
  "Majestic 70":             { cost: 3.30, category: "landscape",     infillType: "agl",       rollSize: "13x100", historicalRange: [9.50, 10.70, 14.00] },
  "TexasPutt (pro putt 44)": { cost: 2.29, category: "putting_green", infillType: "sand_only", rollSize: "15x100", historicalRange: [15.50, 16.00, 27.50] },
};

export const INFILL_PRODUCTS: Record<string, InfillProduct> = {
  "Sand":                         { costPerLb: 3.94 / 50,  label: "Sand (default)" },
  "Wonderfill Green 12/20":       { costPerLb: 11.57 / 50, label: "Wonderfill Green 12/20" },
  "Wonderfill Green/Black 30/50": { costPerLb: 13.07 / 50, label: "Wonderfill Green/Black 30/50" },
};

export const EDGING_PRODUCTS: Record<string, EdgingProduct> = {
  "Metal Edging Black": { materialPerLF: 23.85 / 10,  laborPerLF: 1.00 },
  "Metal Edging Brown": { materialPerLF: 23.85 / 10,  laborPerLF: 1.00 },
  "Wonder Edge Black":  { materialPerLF: 9.78 / 7.5,  laborPerLF: 0.50 },
  "Wonder Edge Brown":  { materialPerLF: 9.78 / 7.5,  laborPerLF: 0.50 },
  "Wonder Edge Green":  { materialPerLF: 12.39 / 7.5, laborPerLF: 0.50 },
  "Bendaboard":         { materialPerLF: 44.44 / 20,  laborPerLF: 1.50 },
};

export const NAILER_BOARD: Record<"standard" | "concrete_anchors", NailerOption> = {
  standard:         { costPerLF: 3.50, label: "Standard" },
  concrete_anchors: { costPerLF: 4.00, label: "Anchored (with rebar/concrete anchors)" },
};

export const TEAROUT_TIERS: Record<string, TearoutTier> = {
  "1":  { rate: 0,        description: "Bare dirt — no demo, no line item" },
  "2":  { rate: 0,        description: "Light organic cover — no demo" },
  "3":  { rate: 0,        description: "Established grass / light sod — no charge, logged for analysis" },
  "4":  { rate: 0,        description: "Thick grass / light sod — no charge, logged" },
  "5":  { rate: 0.75,     description: "Very thick sod / heavy weeds" },
  "6":  { rate: 0.75,     description: "Sod over light base (sand / DG / thin base)" },
  "7":  { rate: 1.75,     description: "Gravel / rock / turf over compacted base" },
  "8":  { rate: 1.75,     description: "Multiple layers (sod + base + edging, etc.)" },
  "9":  { rate: "review", description: "Hardscape / structural (concrete edging, pavers, footings)" },
  "10": { rate: "review", description: "Extreme tear-out (thick concrete, asphalt, restricted access)" },
};

export const LABOR_DEFAULTS: Record<"soil_standard" | "soil_small" | "putting_green" | "concrete", LaborDefault> = {
  soil_standard: { rate: 1.60, description: "Standard soil install ≥600 sqft (typical $1.50–$1.70)" },
  soil_small:    { rate: 1.90, description: "Small job <600 sqft (typical $1.80–$2.00)" },
  putting_green: { rate: 2.00, description: "Putting green (typical ~$2.00)" },
  concrete:      { rate: 1.10, description: "Concrete install (typical $1.00–$1.20)" },
};

export const COMMISSION_TIERS: CommissionTier[] = [
  { minMargin: 0,  maxMargin: 40,   rate: 0,    label: "Below quote floor — manager review", requiresReview: true },
  { minMargin: 40, maxMargin: 50,   rate: 0.04, label: "4% of GP" },
  { minMargin: 50, maxMargin: 60,   rate: 0.06, label: "6% of GP" },
  { minMargin: 60, maxMargin: null, rate: 0.08, label: "8% of GP" },
];

export const CALCULATION_CONSTANTS = {
  DG_COST_PER_CY:       44.66,
  DG_SQFT_PER_CY:       200,
  FIXINGS_COST_PER_SET: 85.03,
  FIXINGS_SQFT_PER_SET: 1500,
  INFILL_LBS_PER_SQFT:  1.75,
  GLUE_COST_PER_GAL:    44.63,
  GLUE_LF_PER_GAL:      100,
  GLUE_SQFT_PER_GAL:    40,
  SEAM_TAPE_PER_LF:     0.24,
  // Widened to number (not the literal 40) so the DB-backed engine config can
  // override it per fiscal year.
  MIN_MARGIN_FOR_QUOTE: 40 as number,
  MARGIN_SLIDER_MIN:    30,
  MARGIN_SLIDER_MAX:    70,
} as const;

export const MANAGER_REVIEW_REASONS = {
  UNKNOWN_PRODUCT:  "Product not in COGS catalog",
  TEAROUT_EXTREME:  "Tear-out tier",
  DIFFICULT_ACCESS: "Difficult access (stairs, steep driveway, bucket carry, restricted gates)",
  LOW_MARGIN:       "Target margin below 40%",
} as const;

export const PricingData = {
  TURF_PRODUCTS,
  INFILL_PRODUCTS,
  EDGING_PRODUCTS,
  NAILER_BOARD,
  TEAROUT_TIERS,
  LABOR_DEFAULTS,
  COMMISSION_TIERS,
  CALCULATION_CONSTANTS,
  MANAGER_REVIEW_REASONS,
};

export type PricingDataT = typeof PricingData;
