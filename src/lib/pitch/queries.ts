import { createClient } from "@/lib/supabase/server";
import type { PitchTier, PitchSession, PitchDeck, InvProduct } from "@/lib/db-helpers.types";
import type { Tier, PitchSessionView, ClientPrice, TierWarranty } from "./types";
import { DEFAULT_DECK, visibleSlides, type StoredSlide, type DeckSlide } from "./deck";

/** Map a DB row to the resolved Tier shape used by pricing functions. */
export function rowToTier(row: PitchTier): Tier {
  return {
    key: row.key,
    name: row.name,
    sort: row.sort,
    productLabel: row.product_label,
    pricingKey: row.pricing_key,
    targetMargin: Number(row.target_margin),
    infillMode: row.infill_mode === "none" ? "none" : "standard",
    inclusions: Array.isArray(row.inclusions) ? (row.inclusions as string[]) : [],
    warranty: row.warranty as TierWarranty,
  };
}

export async function getActiveTiers(): Promise<Tier[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pitch_tiers")
    .select("*")
    .eq("is_active", true)
    .order("sort", { ascending: true });
  return (data ?? []).map(rowToTier);
}

export async function getAllTiers(): Promise<PitchTier[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("pitch_tiers").select("*").order("sort", { ascending: true });
  return data ?? [];
}

export async function getInventoryProducts(): Promise<InvProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inv_products")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getPitchSession(id: string): Promise<PitchSessionView | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("pitch_sessions").select("*").eq("id", id).single();
  if (!data) return null;
  const row = data as PitchSession;
  return {
    id: row.id,
    prospectName: row.prospect_name,
    address: row.address,
    prices: (row.quote_snapshot as ClientPrice[]) ?? [],
    selectedTier: row.selected_tier,
  };
}

export async function getRecentSessions(): Promise<PitchSession[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pitch_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);
  return data ?? [];
}

export async function getDecks(): Promise<PitchDeck[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pitch_decks")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getDeck(id: string): Promise<PitchDeck | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("pitch_decks").select("*").eq("id", id).single();
  return data ?? null;
}

/** The visible slides a present session should render — its deck, else the default deck, else the code default. */
export async function getDeckSlidesForSession(sessionId: string): Promise<DeckSlide[]> {
  const supabase = await createClient();
  const { data: sess } = await supabase.from("pitch_sessions").select("deck_id").eq("id", sessionId).single();
  const deckId = (sess as { deck_id: string | null } | null)?.deck_id ?? null;

  let deck: PitchDeck | null = null;
  if (deckId) deck = await getDeck(deckId);
  if (!deck) {
    const { data } = await supabase.from("pitch_decks").select("*").eq("is_default", true).maybeSingle();
    deck = data ?? null;
  }
  if (!deck) return DEFAULT_DECK;

  const stored = Array.isArray(deck.slides) ? (deck.slides as StoredSlide[]) : [];
  const visible = visibleSlides(stored);
  return visible.length ? visible : DEFAULT_DECK;
}
