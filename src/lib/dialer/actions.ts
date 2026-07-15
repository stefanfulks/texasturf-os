"use server";

/**
 * Power-dialer server actions (spec §4/§6): create lists, place bridge calls,
 * log dispositions. All writes go through the user-context client so RLS
 * applies (AGENTS.md §6). placeCall is the pluggable seam — the Phase-2
 * softphone swap changes placeBridgeCall's body, nothing here.
 */

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { placeBridgeCall } from "@/lib/twilio/bridge";
import { logCallStart } from "@/lib/calls/log";
import type { CallListItem } from "@/lib/db-helpers.types";
import type { CallOutcome, DialCandidate, DialerBrand } from "./types";

export type DialerActionResult = { ok: true } | { ok: false; reason: string };
export type PlaceCallResult =
  | { ok: true; attemptId: string }
  | { ok: false; reason: string };

async function requireUserId(): Promise<string | null> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.id ?? null;
}

/** Create a named list from builder candidates and jump into it. */
export async function createCallList(input: {
  name: string;
  description: string | null;
  brand: DialerBrand;
  candidates: DialCandidate[];
}): Promise<{ ok: false; reason: string } | never> {
  const name = input.name.trim();
  if (!name) return { ok: false, reason: "Give the list a name." };
  if (!input.candidates.length) return { ok: false, reason: "Add at least one person." };

  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "Sign in first." };

  const sb = await createClient();
  const { data: list, error } = await sb
    .from("call_lists")
    .insert({
      name,
      description: input.description?.trim() || null,
      brand: input.brand,
      owner_id: userId,
    })
    .select("id")
    .single();
  if (error || !list) {
    Sentry.captureException(error, { tags: { feature: "dialer", action: "createCallList" } });
    return { ok: false, reason: "Couldn't create the list — try again." };
  }

  // Dedupe defensively (unique index would reject the whole batch otherwise).
  const seen = new Set<string>();
  const items = input.candidates
    .filter((c) => {
      const key = `${c.targetType}:${c.targetId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c, i) => ({
      call_list_id: list.id as string,
      target_type: c.targetType,
      target_id: c.targetId,
      position: i,
      snapshot_name: c.name,
      snapshot_phone: c.phone,
      snapshot_company: c.company,
      added_by: userId,
    }));

  const { error: itemsError } = await sb.from("call_list_items").insert(items);
  if (itemsError) {
    Sentry.captureException(itemsError, { tags: { feature: "dialer", action: "createCallList" } });
    return { ok: false, reason: "List created but adding people failed — open it and retry." };
  }

  revalidatePath("/sales/dialer");
  redirect(`/sales/dialer/${list.id}`);
}

/**
 * Dial one list item over the existing bridge flow. Creates the call_attempts
 * row first (outcome stays null until the rep logs a disposition), links the
 * target's most recent open deal when there is one (spec §5 — the voice-status
 * webhook logs to that deal's timeline), then stamps the returned CallSid.
 */
export async function placeCall(callListItemId: string): Promise<PlaceCallResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "Sign in first." };

  const sb = await createClient();
  const { data: itemRow } = await sb
    .from("call_list_items")
    .select("*")
    .eq("id", callListItemId)
    .maybeSingle();
  const item = itemRow as CallListItem | null;
  if (!item) return { ok: false, reason: "This list entry no longer exists." };

  const phone = item.snapshot_phone?.trim();
  if (!phone) return { ok: false, reason: "No phone number on this entry." };

  // Link the deal when the target has one, so the timeline stays complete.
  let dealId: string | null = null;
  if (item.target_type === "sales_contact") {
    const { data: deal } = await sb
      .from("deals")
      .select("id")
      .eq("sales_contact_id", item.target_id)
      .not("stage", "in", '("closed_won","closed_lost")')
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    dealId = (deal as { id: string } | null)?.id ?? null;
  }

  const { data: attempt, error } = await sb
    .from("call_attempts")
    .insert({
      call_list_item_id: item.id,
      call_list_id: item.call_list_id,
      target_type: item.target_type,
      target_id: item.target_id,
      deal_id: dealId,
      rep_id: userId,
    })
    .select("id")
    .single();
  if (error || !attempt) {
    Sentry.captureException(error, { tags: { feature: "dialer", action: "placeCall" } });
    return { ok: false, reason: "Couldn't start the call — try again." };
  }
  const attemptId = attempt.id as string;

  const statusParams = new URLSearchParams({ attemptId });
  if (dealId) statusParams.set("dealId", dealId);
  const bridged = await placeBridgeCall({
    toPhone: phone,
    statusCallbackPath: `/api/twilio/voice-status?${statusParams.toString()}`,
  });
  if (!bridged.ok) return { ok: false, reason: bridged.reason };

  // Brand rides on the list (drives the recording/AI review pipeline).
  const { data: list } = await sb
    .from("call_lists")
    .select("brand")
    .eq("id", item.call_list_id)
    .maybeSingle();
  const brand = (list as { brand: string } | null)?.brand === "turfcasa" ? "turfcasa" : "texasturf";

  await Promise.all([
    sb.from("call_attempts").update({ call_sid: bridged.callSid }).eq("id", attemptId),
    sb
      .from("call_list_items")
      .update({ called_at: new Date().toISOString() })
      .eq("id", item.id),
    // Phase 2: the calls row — recording + AI review attach to this.
    logCallStart({
      call_attempt_id: attemptId,
      deal_id: dealId,
      caller_id: userId,
      target_type: item.target_type,
      target_id: item.target_id,
      target_name: item.snapshot_name,
      target_phone: phone,
      twilio_call_sid: bridged.callSid,
      brand,
    }),
  ]);

  return { ok: true, attemptId };
}

/**
 * The rep's post-call disposition (spec §6): updates the attempt's outcome and
 * rolls the list item forward (attempts++, last_outcome, status). Terminal
 * outcomes mark the item done; retryable ones leave it at 'called'.
 */
export async function logDisposition(input: {
  callListItemId: string;
  attemptId: string | null;
  outcome: CallOutcome;
  note: string | null;
  callbackAt: string | null;
}): Promise<DialerActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "Sign in first." };

  const sb = await createClient();
  const { data: itemRow } = await sb
    .from("call_list_items")
    .select("*")
    .eq("id", input.callListItemId)
    .maybeSingle();
  const item = itemRow as CallListItem | null;
  if (!item) return { ok: false, reason: "This list entry no longer exists." };

  const terminal = ["connected", "bad_number", "not_interested", "do_not_call"].includes(
    input.outcome,
  );
  const callbackAt = input.outcome === "callback_scheduled" ? input.callbackAt : null;

  if (input.attemptId) {
    await Promise.all([
      sb
        .from("call_attempts")
        .update({
          outcome: input.outcome,
          note: input.note?.trim() || null,
          callback_at: callbackAt,
        })
        .eq("id", input.attemptId),
      // Mirror onto the recording anchor (Phase 2) so the Calls list shows
      // the human disposition alongside the AI review.
      sb
        .from("calls")
        .update({ outcome: input.outcome })
        .eq("call_attempt_id", input.attemptId),
    ]);
  }

  const { error } = await sb
    .from("call_list_items")
    .update({
      status: terminal ? "done" : "called",
      attempts: item.attempts + 1,
      last_outcome: input.outcome,
      called_at: item.called_at ?? new Date().toISOString(),
    })
    .eq("id", item.id);
  if (error) {
    Sentry.captureException(error, { tags: { feature: "dialer", action: "logDisposition" } });
    return { ok: false, reason: "Couldn't save the outcome — try again." };
  }

  revalidatePath(`/sales/dialer/${item.call_list_id}`);
  return { ok: true };
}

/** Skip without dialing (wrong fit, duplicate, …). */
export async function skipItem(callListItemId: string): Promise<DialerActionResult> {
  const sb = await createClient();
  const { data: itemRow, error } = await sb
    .from("call_list_items")
    .update({ status: "skipped" })
    .eq("id", callListItemId)
    .select("call_list_id")
    .maybeSingle();
  if (error) return { ok: false, reason: "Couldn't skip — try again." };
  const listId = (itemRow as { call_list_id: string } | null)?.call_list_id;
  if (listId) revalidatePath(`/sales/dialer/${listId}`);
  return { ok: true };
}

export async function setListStatus(
  listId: string,
  status: "active" | "completed" | "archived",
): Promise<DialerActionResult> {
  const sb = await createClient();
  const { error } = await sb
    .from("call_lists")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", listId);
  if (error) return { ok: false, reason: "Couldn't update the list." };
  revalidatePath("/sales/dialer");
  revalidatePath(`/sales/dialer/${listId}`);
  return { ok: true };
}

// Re-exported here so the builder client component imports one actions module.
export async function searchContactCandidates(filters: {
  stage?: string;
  segment?: string;
  source?: string;
}): Promise<DialCandidate[]> {
  const { getContactCandidates } = await import("./queries");
  return getContactCandidates(filters);
}

export async function searchJobberCandidates(search: string): Promise<DialCandidate[]> {
  const { getJobberCandidates } = await import("./queries");
  return getJobberCandidates(search);
}

export async function listTurfcasaCandidates(): Promise<DialCandidate[]> {
  const { getTurfcasaCandidates } = await import("./queries");
  return getTurfcasaCandidates();
}
