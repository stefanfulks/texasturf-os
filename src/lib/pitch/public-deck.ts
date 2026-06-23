/**
 * Public (no-auth) loader for a shared self-explore link. Uses the service-role
 * client because there is no signed-in user — so the projection MUST be a
 * hand-written allowlist. We NEVER select base_job, quote_v2, quote_snapshot,
 * selected_tier, or anything carrying cogs/margin/commission. Pricing + close
 * slides are filtered out too. This function is the public-safety boundary.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { DEFAULT_DECK, visibleSlides, type DeckSlide, type StoredSlide } from "./deck";

export type PublicDeck = {
  display: { prospectName: string | null; address: string | null };
  slides: DeckSlide[];
};

function customerSafe(slides: DeckSlide[]): DeckSlide[] {
  return slides.filter((s) => s.kind !== "pricing" && s.kind !== "close");
}

export async function getPublicDeckByToken(token: string): Promise<PublicDeck | null> {
  if (!token) return null;
  const supabase = createServiceClient();

  // ALLOWLIST — only these columns, ever. No pricing / quote / base_job fields.
  const { data: sess } = await supabase
    .from("pitch_sessions")
    .select("id, prospect_name, address, deck_id, share_enabled, share_expires_at")
    .eq("share_token", token)
    .maybeSingle();

  if (!sess || sess.share_enabled !== true) return null;
  if (sess.share_expires_at && new Date(sess.share_expires_at as string).getTime() < Date.now()) return null;

  // Resolve deck slides: session's deck → default deck → code default.
  let stored: StoredSlide[] | null = null;
  const deckId = (sess.deck_id as string | null) ?? null;
  if (deckId) {
    const { data: deck } = await supabase.from("pitch_decks").select("slides").eq("id", deckId).maybeSingle();
    if (deck && Array.isArray(deck.slides)) stored = deck.slides as StoredSlide[];
  }
  if (!stored) {
    const { data: deck } = await supabase.from("pitch_decks").select("slides").eq("is_default", true).maybeSingle();
    if (deck && Array.isArray(deck.slides)) stored = deck.slides as StoredSlide[];
  }
  const base = stored ? visibleSlides(stored) : DEFAULT_DECK;
  const slides = customerSafe(base.length ? base : DEFAULT_DECK);

  return { display: { prospectName: sess.prospect_name, address: sess.address }, slides };
}
