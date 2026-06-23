"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getJobberAccountId, getClientPropertyId, createPitchQuote, type PitchQuoteLine } from "@/lib/jobber/quotes";
import type { ClientPrice, ClientQuoteV2 } from "@/lib/pitch/types";

export type AcceptResult = { ok: boolean; error?: string; total?: number; deposit?: number; dealId?: string; clientHubUri?: string | null };

const DEPOSIT_PCT = 50; // residential default (AR-SOP)

/** Mark a session as presented the first time its deck is opened (draft → presented). */
export async function markPresented(sessionId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("pitch_sessions")
    .update({ status: "presented", presented_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "draft");
}

/**
 * Close the pitch on-site: record the chosen tier, create/link a won Deal with a
 * deposit-agreed activity, and mark the session accepted. The live Jobber quote +
 * deposit collection is a later, gated step — here we capture the commitment so it
 * lands in the pipeline immediately.
 */
export async function acceptPitch(sessionId: string, tier?: string | null): Promise<AcceptResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: sess } = await supabase
    .from("pitch_sessions")
    .select("id, prospect_name, address, base_job, quote_snapshot, quote_v2, client_id, deal_id")
    .eq("id", sessionId)
    .single();
  if (!sess) return { ok: false, error: "Pitch not found" };

  const v2 = (sess.quote_v2 as unknown as ClientQuoteV2 | null) ?? null;
  // No tier passed + a multi-area quote present → close the v2 quote; otherwise legacy tier.
  const useV2 = tier == null && v2 != null;
  if (tier == null && !v2) return { ok: false, error: "No quote to reserve yet — build the quote first." };

  let total: number;
  let dealLabel: string;            // deal name + activity copy
  let selectedTier: string | null;  // stored on the session
  let lineItems: PitchQuoteLine[];  // Jobber quote breakdown
  const baseJob = (sess.base_job as { installedSqft?: number } | null) ?? {};

  if (useV2) {
    if (v2!.reviewRequired || v2!.total == null) return { ok: false, error: "This quote needs review before it can be reserved." };
    total = v2!.total;
    dealLabel = "multi-area turf install";
    selectedTier = null;
    lineItems = [
      ...v2!.areas.map((a) => ({ name: `${a.label} — ${a.productLabel}${a.sqft ? ` (${a.sqft.toLocaleString()} sq ft)` : ""}`, unitPrice: a.price ?? 0 })),
      ...v2!.addons.map((a) => ({ name: a.label, unitPrice: a.price })),
    ].filter((li) => li.unitPrice > 0);
  } else {
    const prices = (sess.quote_snapshot as ClientPrice[]) ?? [];
    const chosen = prices.find((p) => p.tier === tier);
    if (!chosen || chosen.total == null) return { ok: false, error: "That tier needs a custom quote — can't reserve it here." };
    total = chosen.total;
    dealLabel = `${chosen.name} install`;
    selectedTier = tier ?? null;
    const sqft0 = typeof baseJob.installedSqft === "number" ? baseJob.installedSqft : null;
    lineItems = [{ name: `${chosen.name} turf install${sqft0 ? ` — ${sqft0} sq ft` : ""}`, unitPrice: total }];
  }

  const deposit = Math.round((total * DEPOSIT_PCT) / 100);

  // Idempotent: if this pitch already produced a deal, just report the numbers.
  if (sess.deal_id) return { ok: true, total, deposit, dealId: sess.deal_id as string };

  const sqft = typeof baseJob.installedSqft === "number"
    ? baseJob.installedSqft
    : useV2 ? (v2!.areas.reduce((s, a) => s + a.sqft, 0) || null) : null;

  // A deal needs a party: use the linked Jobber client, else spin up a sales contact.
  const jobberClientId = (sess.client_id as string | null) ?? null;
  let salesContactId: string | null = null;
  if (!jobberClientId) {
    const { data: contact } = await supabase
      .from("sales_contacts")
      .insert({
        name: sess.prospect_name || "Pitch prospect",
        notes: sess.address || null,
        source: "pitch",
        created_by: user.id,
      })
      .select("id")
      .single();
    salesContactId = contact?.id ?? null;
    if (!salesContactId) return { ok: false, error: "Could not create the contact" };
  }

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .insert({
      name: `${sess.prospect_name || "Turf"} — ${dealLabel}`,
      stage: "closed_won",
      value_usd: total,
      sqft,
      service_line: "backyard_install",
      sales_contact_id: salesContactId,
      jobber_client_id: jobberClientId,
      closed_at: new Date().toISOString(),
      owner_id: user.id,
    })
    .select("id")
    .single();
  if (dealErr || !deal) return { ok: false, error: dealErr?.message ?? "Could not create the deal" };

  // Best-effort: build the quote IN Jobber and grab its client-hub URL so the
  // client is redirected to Jobber to approve + pay (Wisestack shows there). If
  // Jobber isn't write-enabled, the client isn't a Jobber client, or anything
  // fails, we keep the deposit-agreed record + manual handoff — close never breaks.
  let clientHubUri: string | null = null;
  let jobberQuoteId: string | null = null;
  if (jobberClientId) {
    try {
      const accountId = await getJobberAccountId();
      const propertyId = accountId ? await getClientPropertyId(accountId, jobberClientId) : null;
      if (accountId && propertyId) {
        const q = await createPitchQuote(accountId, {
          clientId: jobberClientId,
          propertyId,
          title: `Texas Turf — ${dealLabel}`,
          lineItems,
          depositPct: DEPOSIT_PCT,
        });
        clientHubUri = q.clientHubUri;
        jobberQuoteId = q.quoteId;
      }
    } catch (e) {
      console.error("[pitch] Jobber quote creation failed; falling back to manual handoff", e);
    }
  }

  await supabase.from("deal_activities").insert({
    deal_id: deal.id,
    kind: "note",
    body: clientHubUri
      ? `Pitch accepted on-site: ${dealLabel} — $${total.toLocaleString()}. Quote built in Jobber (${DEPOSIT_PCT}% deposit); client sent to Jobber to approve + pay.`
      : `Pitch accepted on-site: ${dealLabel} — $${total.toLocaleString()}. Deposit agreed $${deposit.toLocaleString()} (${DEPOSIT_PCT}%). Finalize quote + collect deposit in Jobber.`,
    metadata: {
      source: "pitch", tier: selectedTier, total,
      deposit_pct: DEPOSIT_PCT, deposit_usd: deposit,
      payment_status: clientHubUri ? "quote_sent" : "agreed",
      jobber_quote_id: jobberQuoteId, jobber_client_hub_uri: clientHubUri,
    },
    created_by: user.id,
  });

  await supabase
    .from("pitch_sessions")
    .update({ status: "accepted", selected_tier: selectedTier, deal_id: deal.id, decided_at: new Date().toISOString() })
    .eq("id", sessionId);

  revalidatePath("/pitch");
  return { ok: true, total, deposit, dealId: deal.id, clientHubUri };
}
