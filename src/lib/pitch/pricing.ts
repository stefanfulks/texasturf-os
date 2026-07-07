import { calculateQuote, type Job, type QuoteResult } from "@/lib/pricing/calculator";
import {
  DEFAULT_ENGINE_CONFIG,
  laborRateFor,
  wasteFor,
  type EngineConfig,
} from "@/lib/engine/config";
import type { BaseJob, Tier, ClientPrice } from "./types";

/** Labor suggestion — delegates to the engine (single implementation). The
 * optional product param routes putting greens to their premium rate; the old
 * two-arg body previously missed that check and under-priced green labor. */
export function suggestLaborRate(
  application: BaseJob["application"],
  sqft: number,
  product?: string,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  return laborRateFor({ application, installedSqft: sqft, product }, config);
}

/** Turn a tier + the salesperson's job basics into a calculator Job. Waste %
 * and labor rate come from the engine — this kills the drifted hardcoded 10%
 * waste that silently under-wasted putting greens quoted through the deck. */
export function buildTierJob(
  base: BaseJob,
  tier: Tier,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): Partial<Job> {
  return {
    product: tier.pricingKey,
    installedSqft: base.installedSqft,
    wastePct: wasteFor(tier.pricingKey, config),
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
    laborRate: laborRateFor(
      { application: base.application, installedSqft: base.installedSqft, product: tier.pricingKey },
      config,
    ),
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
export function priceTiers(
  base: BaseJob,
  tiers: Tier[],
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): ClientPrice[] {
  return tiers.map((t) =>
    toClientPrice(calculateQuote(buildTierJob(base, t, config), config.pricing), t),
  );
}
