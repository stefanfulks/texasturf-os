/**
 * Pure lookup: inbound caller's phone → matched contact (if any) → most-recent
 * open deal (if any) → owner's mobile (if profile has one set on Settings →
 * Account). Used by the voice-inbound webhook to decide whether to dial an
 * owner or fall through to voicemail. RLS-bypassing service client expected —
 * caller is anonymous (Twilio webhook).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type InboundLookup =
  | { matched: false }
  | {
      matched: true;
      contact: { id: string; name: string };
      deal: { id: string; name: string; ownerId: string | null } | null;
      ownerMobile: string | null;
    };

const OPEN_STAGES = [
  "lead", "qualified", "site_visit", "quote_sent", "negotiation",
] as const;

export async function lookupInboundCaller(
  sb: SupabaseClient,
  fromNumber: string,
): Promise<InboundLookup> {
  const { data: contactRow } = await sb
    .from("sales_contacts")
    .select("id, name")
    .eq("phone", fromNumber)
    .maybeSingle();
  const contactRaw = contactRow as { id: string; name: string } | null;
  if (!contactRaw) return { matched: false };
  // Explicit projection — don't pass through extra columns the row may carry.
  const contact = { id: contactRaw.id, name: contactRaw.name };

  const { data: dealRow } = await sb
    .from("deals")
    .select("id, name, owner_id")
    .eq("sales_contact_id", contact.id)
    .in("stage", OPEN_STAGES as unknown as string[])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const deal = dealRow as { id: string; name: string; owner_id: string | null } | null;

  if (!deal) {
    return { matched: true, contact, deal: null, ownerMobile: null };
  }

  let ownerMobile: string | null = null;
  if (deal.owner_id) {
    const { data: profile } = await sb
      .from("profiles")
      .select("mobile")
      .eq("id", deal.owner_id)
      .maybeSingle();
    const m = (profile as { mobile: string | null } | null)?.mobile?.trim();
    ownerMobile = m && m.length > 0 ? m : null;
  }

  return {
    matched: true,
    contact,
    deal: { id: deal.id, name: deal.name, ownerId: deal.owner_id },
    ownerMobile,
  };
}
