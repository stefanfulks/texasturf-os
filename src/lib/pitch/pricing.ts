import { calculateQuote, type Job, type QuoteResult } from "@/lib/pricing/calculator";
import type { BaseJob, Tier, ClientPrice } from "./types";

/** Mirrors LABOR_DEFAULTS in pricing/data.ts; calculateQuote takes laborRate as input. */
export function suggestLaborRate(application: BaseJob["application"], sqft: number): number {
  if (application === "concrete") return 1.1;
  return sqft >= 600 ? 1.6 : 1.9;
}

/** Turn a tier + the salesperson's job basics into a calculator Job. */
export function buildTierJob(base: BaseJob, tier: Tier): Partial<Job> {
  return {
    product: tier.pricingKey,
    installedSqft: base.installedSqft,
    wastePct: 10,
    application: base.application,
    tearoutTier: base.tearoutTier,
    access: base.access,
    infillProduct: "Sand",
    edgings: [],
    nailerLF: 0,
    nailerType: "standard",
    glueMode: base.application === "concrete" ? "full" : "perimeter",
    glueLF: 0,
    seamTapeLF: 0,
    laborRate: suggestLaborRate(base.application, base.installedSqft),
    extras: [],
    targetMargin: tier.targetMargin,
  };
}

/** Strip the quote down to what a client may see. NEVER include cogs/margin/commission. */
export function toClientPrice(quote: QuoteResult, tier: Tier): ClientPrice {
  return {
    tier: tier.key,
    name: tier.name,
    productLabel: tier.productLabel,
    total: quote.price,
    perSqft: quote.pricePerSqft,
    reviewRequired: quote.price === null,
    inclusions: tier.inclusions,
    warranty: tier.warranty,
  };
}

/** Convenience: price every tier for a base job. */
export function priceTiers(base: BaseJob, tiers: Tier[]): ClientPrice[] {
  return tiers.map((t) => toClientPrice(calculateQuote(buildTierJob(base, t)), t));
}
