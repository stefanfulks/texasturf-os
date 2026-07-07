"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTiers } from "@/lib/pitch/queries";
import { loadEngineConfig } from "@/lib/engine/load";
import { priceMultiArea, toClientQuoteV2 } from "@/lib/pitch/quote-v2";
import type { PitchArea, PitchAddon } from "@/lib/db-helpers.types";
import type { ClientQuoteV2 } from "@/lib/pitch/types";
import type { Json } from "@/lib/database.types";

export type AreaInput = {
  id: string; label: string; product: string; installed_sqft: number;
  application: string; tearout_tier: string; access: string;
  target_margin: number | null; tier_key: string | null;
};
export type AddonInput = { label: string; kind: string; cost: number; qty: number };

export type PriceResult = {
  ok: boolean;
  error?: string;
  client?: ClientQuoteV2;
  privateView?: {
    cogs: number;
    total: number | null;
    perArea: { label: string; sqft: number; price: number | null; cogs: number }[];
    reviewFlags: string[];
  };
};

/**
 * Persist the rep's area + add-on edits, price every area server-side (COGS
 * never leaves the server), store the CLIENT-SAFE multi-area quote, and advance
 * the session to `quoting`. Returns both the client quote and a PRIVATE view
 * (cogs / per-area / review flags) for the rep's builder panel.
 */
export async function saveAndPriceQuote(sessionId: string, areas: AreaInput[], addons: AddonInput[]): Promise<PriceResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  for (const a of areas) {
    await supabase
      .from("pitch_areas")
      .update({
        label: a.label, product: a.product, installed_sqft: a.installed_sqft,
        application: a.application, tearout_tier: a.tearout_tier, access: a.access,
        target_margin: a.target_margin, tier_key: a.tier_key, updated_at: new Date().toISOString(),
      })
      .eq("id", a.id);
  }

  await supabase.from("pitch_addons").delete().eq("session_id", sessionId);
  if (addons.length) {
    await supabase.from("pitch_addons").insert(
      addons.map((ad, i) => ({ session_id: sessionId, sort: i, label: ad.label, kind: ad.kind, cost: ad.cost, qty: ad.qty })),
    );
  }

  const [{ data: areaRows }, { data: addonRows }] = await Promise.all([
    supabase.from("pitch_areas").select("*").eq("session_id", sessionId).order("sort", { ascending: true }),
    supabase.from("pitch_addons").select("*").eq("session_id", sessionId).order("sort", { ascending: true }),
  ]);

  const tiers = await getActiveTiers();
  const engineConfig = await loadEngineConfig(supabase);
  const fallbackMargin = tiers[0]?.targetMargin ?? 50;
  const warranty = tiers.find((t) => t.key === "platinum")?.warranty ?? tiers[0]?.warranty ?? { residential_years: 15, commercial_years: 8, prorated: true };
  const labelByKey = new Map(tiers.map((t) => [t.pricingKey, t.productLabel]));

  const mq = priceMultiArea((areaRows ?? []) as PitchArea[], (addonRows ?? []) as PitchAddon[], fallbackMargin, engineConfig);
  const client = toClientQuoteV2(mq, warranty, (area) => labelByKey.get(area.product) ?? area.product);

  await supabase
    .from("pitch_sessions")
    .update({ quote_v2: client as unknown as Json, quote_total: client.total, status: "quoting", quoted_at: new Date().toISOString() })
    .eq("id", sessionId);

  revalidatePath(`/pitch/${sessionId}/quote`);
  revalidatePath(`/present/${sessionId}`);

  return {
    ok: true,
    client,
    privateView: {
      cogs: mq.cogs,
      total: mq.total,
      perArea: mq.areaQuotes.map((q) => ({ label: q.area.label, sqft: Number(q.area.installed_sqft) || 0, price: q.result.price, cogs: q.result.cogs })),
      reviewFlags: mq.reviewFlags,
    },
  };
}
