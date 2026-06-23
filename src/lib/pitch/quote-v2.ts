/**
 * Multi-area quote engine (Pitch v2). Reuses the verified single-job
 * calculateQuote() once per area, then aggregates. PRIVATE (cogs/margin) stays
 * server-side; toClientQuoteV2() is the only thing safe to send to a customer.
 *
 * Import this ONLY from server code — it pulls in pricing/data.ts (COGS).
 */

import { calculateQuote, type Job, type QuoteResult } from "@/lib/pricing/calculator";
import { suggestLaborRate } from "./pricing";
import type { ClientQuoteV2, TierWarranty } from "./types";
import type { PitchArea, PitchAddon } from "@/lib/db-helpers.types";

/** Turn a stored area row into a calculator Job (mirrors buildTierJob, per-area). */
export function areaToJob(area: PitchArea, fallbackMargin: number): Partial<Job> {
  const application: Job["application"] = area.application === "concrete" ? "concrete" : "soil";
  const sqft = Number(area.installed_sqft) || 0;
  return {
    product: area.product,
    installedSqft: sqft,
    wastePct: 10,
    application,
    tearoutTier: area.tearout_tier,
    access: area.access === "difficult" ? "difficult" : "normal",
    infillProduct: area.infill_product ?? "Sand",
    edgings: Array.isArray(area.edgings) ? (area.edgings as Job["edgings"]) : [],
    nailerLF: 0,
    nailerType: "standard",
    glueMode: application === "concrete" ? "full" : "perimeter",
    glueLF: 0,
    seamTapeLF: 0,
    laborRate: suggestLaborRate(application, sqft),
    extras: Array.isArray(area.extras) ? (area.extras as Job["extras"]) : [],
    targetMargin: area.target_margin != null ? Number(area.target_margin) : fallbackMargin,
  };
}

export type AreaQuote = { area: PitchArea; result: QuoteResult };
export type PricedAddon = { addon: PitchAddon; clientPrice: number };

export type MultiAreaQuote = {
  areaQuotes: AreaQuote[];
  addons: PricedAddon[];
  cogs: number;                 // PRIVATE
  total: number | null;         // null if ANY area needs review
  reviewFlags: string[];        // area-labeled
};

/** Add-ons are marked up at the deal margin from their cost basis. */
function addonClientPrice(cost: number, qty: number, margin: number): number {
  const m = Math.min(Math.max(margin, 0), 90) / 100;
  return Math.round((cost * qty) / (1 - m));
}

export function priceMultiArea(areas: PitchArea[], addons: PitchAddon[], fallbackMargin: number): MultiAreaQuote {
  const areaQuotes: AreaQuote[] = areas.map((a) => ({
    area: a,
    result: calculateQuote(areaToJob(a, a.target_margin != null ? Number(a.target_margin) : fallbackMargin)),
  }));

  const reviewFlags = areaQuotes.flatMap((q) => q.result.reviewFlags.map((f) => `${q.area.label}: ${f}`));
  const anyReview = areaQuotes.some((q) => q.result.price === null);
  const areaPrice = anyReview ? null : areaQuotes.reduce((s, q) => s + (q.result.price ?? 0), 0);
  const areaCogs = areaQuotes.reduce((s, q) => s + q.result.cogs, 0);

  const priced: PricedAddon[] = addons.map((ad) => ({
    addon: ad,
    clientPrice: addonClientPrice(Number(ad.cost), Number(ad.qty), fallbackMargin),
  }));
  const addonCogs = addons.reduce((s, ad) => s + Number(ad.cost) * Number(ad.qty), 0);
  const addonTotal = priced.reduce((s, a) => s + a.clientPrice, 0);

  const total = areaPrice === null ? null : areaPrice + addonTotal;
  return { areaQuotes, addons: priced, cogs: areaCogs + addonCogs, total, reviewFlags };
}

/** Strip to the customer-safe shape. NEVER include cogs/margin/per-area cost. */
export function toClientQuoteV2(
  mq: MultiAreaQuote,
  warranty: TierWarranty,
  productLabelFor: (area: PitchArea) => string,
): ClientQuoteV2 {
  const areas = mq.areaQuotes.map((q) => ({
    label: q.area.label,
    productLabel: productLabelFor(q.area),
    sqft: Number(q.area.installed_sqft) || 0,
    price: q.result.price,
  }));
  const totalSqft = areas.reduce((s, a) => s + a.sqft, 0);
  return {
    areas,
    addons: mq.addons.map((a) => ({ label: a.addon.label, price: a.clientPrice })),
    total: mq.total,
    perSqft: mq.total != null && totalSqft > 0 ? Math.round(mq.total / totalSqft) : null,
    warranty,
    reviewRequired: mq.total === null,
  };
}
