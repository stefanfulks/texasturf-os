/**
 * TexasTurf Pricing Calculator — pure function.
 *
 * Ported from standalone pricing-tool (April 2026). No DOM, no side effects.
 * Same shape, same math, just TypeScript types.
 */

import { PricingData, type PricingDataT } from "./data";

export type Application = "soil" | "concrete";
export type Access      = "normal" | "difficult";
export type GlueMode    = "perimeter" | "full";

export type Edging = { type: string; lf: number };
export type Extra  = { description: string; cost: number };

export type Job = {
  product:        string;
  installedSqft:  number;
  wastePct:       number;
  application:    Application;
  tearoutTier:    string;
  access:         Access;
  infillProduct:  string;
  edgings:        Edging[];
  nailerLF:       number;
  nailerType:     "standard" | "concrete_anchors";
  glueMode:       GlueMode;
  glueLF:         number;
  seamTapeLF:     number;
  laborRate:      number;
  extras:         Extra[];
  targetMargin:   number;
};

export type QuoteLine = { label: string; cost: number };

export type NextTierHint = {
  marginTarget:    number;
  priceDelta:      number;
  commissionDelta: number;
  newRate:         number;
};

export type QuoteResult = {
  lines:          QuoteLine[];
  cogs:           number;
  /** null when manager review is required */
  price:          number | null;
  grossProfit:    number | null;
  commissionRate: number;
  commission:     number | null;
  companyNet:     number | null;
  reviewFlags:    string[];
  nextTier:       NextTierHint | null;
  pricePerSqft:   number | null;
};

export function calculateQuote(
  job: Partial<Job>,
  data: PricingDataT = PricingData,
): QuoteResult {
  const {
    TURF_PRODUCTS,
    INFILL_PRODUCTS,
    EDGING_PRODUCTS,
    NAILER_BOARD,
    TEAROUT_TIERS,
    COMMISSION_TIERS,
    CALCULATION_CONSTANTS: C,
    MANAGER_REVIEW_REASONS: R,
  } = data;

  const reviewFlags: string[] = [];
  const lines: QuoteLine[] = [];

  const productName = job.product ?? "";
  const turf = TURF_PRODUCTS[productName];

  if (!turf) {
    reviewFlags.push(R.UNKNOWN_PRODUCT);
    return {
      lines: [], cogs: 0, price: null, grossProfit: null,
      commissionRate: 0, commission: null, companyNet: null,
      reviewFlags, nextTier: null, pricePerSqft: null,
    };
  }

  const installed  = job.installedSqft ?? 0;
  const wastePct   = job.wastePct      ?? 0;
  const wasteSqft  = Math.ceil(installed * wastePct / 100);
  const totalTurf  = installed + wasteSqft;

  // Turf material (includes waste)
  if (installed > 0) {
    lines.push({
      label: `${productName} material (${totalTurf} sqft — incl ${wastePct}% waste)`,
      cost:  totalTurf * turf.cost,
    });

    // Sub install labor (installed sqft only — waste isn't installed)
    lines.push({
      label: `Sub install labor (${installed} sqft @ $${(job.laborRate ?? 0).toFixed(2)})`,
      cost:  installed * (job.laborRate ?? 0),
    });
  }

  // Soil-specific costs
  if (job.application === "soil" && installed > 0) {
    // Decomposed granite base
    const dgCY = +(installed / C.DG_SQFT_PER_CY).toFixed(2);
    lines.push({
      label: `Decomposed granite base (${dgCY} CY)`,
      cost:  dgCY * C.DG_COST_PER_CY,
    });

    // Nails + staples (1 box each per 1500 sqft or portion)
    const fixingsSets = Math.ceil(installed / C.FIXINGS_SQFT_PER_SET);
    lines.push({
      label: `Nails + staples (${fixingsSets} set${fixingsSets > 1 ? "s" : ""})`,
      cost:  fixingsSets * C.FIXINGS_COST_PER_SET,
    });

    // Tear-out
    const tearoutTier = TEAROUT_TIERS[job.tearoutTier ?? "1"];
    if (tearoutTier) {
      if (tearoutTier.rate === "review") {
        reviewFlags.push(`${R.TEAROUT_EXTREME} ${job.tearoutTier}`);
      } else if (tearoutTier.rate > 0) {
        lines.push({
          label: `Tear-out tier ${job.tearoutTier} (${installed} sqft @ $${tearoutTier.rate})`,
          cost:  installed * tearoutTier.rate,
        });
      }
    }

    // Infill (AGL products skip this; putting greens use sand only)
    if (turf.infillType === "standard") {
      const infillKey = job.infillProduct ?? "Sand";
      const infill = INFILL_PRODUCTS[infillKey] ?? INFILL_PRODUCTS.Sand;
      const lbs = installed * C.INFILL_LBS_PER_SQFT;
      lines.push({
        label: `${infillKey} infill (${Math.round(lbs)} lbs)`,
        cost:  lbs * infill.costPerLb,
      });
    } else if (turf.infillType === "sand_only") {
      const lbs = installed * C.INFILL_LBS_PER_SQFT;
      lines.push({
        label: `Sand infill — putting green (${Math.round(lbs)} lbs)`,
        cost:  lbs * INFILL_PRODUCTS.Sand.costPerLb,
      });
    }
  }

  // Concrete-specific costs
  if (job.application === "concrete" && installed > 0) {
    let gallons = 0;
    if (job.glueMode === "perimeter") {
      gallons = (job.glueLF ?? 0) / C.GLUE_LF_PER_GAL;
    } else if (job.glueMode === "full") {
      gallons = installed / C.GLUE_SQFT_PER_GAL;
    }
    if (gallons > 0) {
      lines.push({
        label: `Glue (${gallons.toFixed(1)} gal — ${job.glueMode === "full" ? "full glue-down" : "perimeter + seams"})`,
        cost:  gallons * C.GLUE_COST_PER_GAL,
      });
    }
    if ((job.seamTapeLF ?? 0) > 0) {
      lines.push({
        label: `Seam tape (${job.seamTapeLF} LF)`,
        cost:  (job.seamTapeLF ?? 0) * C.SEAM_TAPE_PER_LF,
      });
    }
  }

  // Edging
  for (const e of (job.edgings ?? [])) {
    if (e.lf > 0 && EDGING_PRODUCTS[e.type]) {
      const edging = EDGING_PRODUCTS[e.type];
      lines.push({
        label: `${e.type} (${e.lf} LF)`,
        cost:  e.lf * (edging.materialPerLF + edging.laborPerLF),
      });
    }
  }

  // Nailer board
  if ((job.nailerLF ?? 0) > 0) {
    const nailer = NAILER_BOARD[job.nailerType ?? "standard"] ?? NAILER_BOARD.standard;
    lines.push({
      label: `Nailer board (${job.nailerLF} LF, ${nailer.label.toLowerCase()})`,
      cost:  (job.nailerLF ?? 0) * nailer.costPerLF,
    });
  }

  // Custom line items
  for (const ex of (job.extras ?? [])) {
    if (ex.cost > 0) {
      lines.push({
        label: ex.description || "Custom line item",
        cost:  ex.cost,
      });
    }
  }

  // Review flags
  if (job.access === "difficult") reviewFlags.push(R.DIFFICULT_ACCESS);
  if ((job.targetMargin ?? 0) < C.MIN_MARGIN_FOR_QUOTE) reviewFlags.push(R.LOW_MARGIN);
  // Guard against 100%+ margin (Price = COGS / (1 - margin) blows up at 1.0).
  // The slider caps at 70 so this shouldn't fire through the UI, but it
  // protects against programmatic or pasted inputs.
  if ((job.targetMargin ?? 0) >= 100) reviewFlags.push("Target margin must be below 100%");

  // Final calculations
  const cogs            = lines.reduce((sum, l) => sum + l.cost, 0);
  const marginDecimal   = (job.targetMargin ?? 0) / 100;
  const canProducePrice = reviewFlags.length === 0 && cogs > 0;
  const price           = canProducePrice ? cogs / (1 - marginDecimal) : null;
  const grossProfit     = price !== null ? price - cogs : null;

  // Commission tier lookup
  let commissionRate = 0;
  for (const tier of COMMISSION_TIERS) {
    if ((job.targetMargin ?? 0) >= tier.minMargin && (job.targetMargin ?? 0) <= tier.maxMargin) {
      commissionRate = tier.rate;
      break;
    }
  }
  const commission = grossProfit !== null ? grossProfit * commissionRate : null;
  const companyNet = grossProfit !== null ? grossProfit - (commission ?? 0) : null;

  // "Raise price to hit next tier" hint
  let nextTier: NextTierHint | null = null;
  if (canProducePrice && price !== null && (job.targetMargin ?? 0) < 60) {
    const nextMarginTarget = (job.targetMargin ?? 0) < 50 ? 50 : 60;
    const nextPrice        = cogs / (1 - nextMarginTarget / 100);
    const nextRate         = nextMarginTarget === 50 ? 0.06 : 0.08;
    const nextCommission   = (nextPrice - cogs) * nextRate;
    nextTier = {
      marginTarget:    nextMarginTarget,
      priceDelta:      nextPrice - price,
      commissionDelta: nextCommission - (commission ?? 0),
      newRate:         nextRate,
    };
  }

  const pricePerSqft = (installed > 0 && price !== null) ? price / installed : null;

  return {
    lines, cogs, price, grossProfit,
    commissionRate, commission, companyNet,
    reviewFlags, nextTier, pricePerSqft,
  };
}
