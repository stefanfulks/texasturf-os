"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clientDisplayName, primaryEmail, primaryPhone } from "@/lib/marketing/jobber-contacts";
import type { Database } from "@/lib/database.types";

export type ActionState = { error: string | null; success: boolean; info?: string };

type OutreachInsert = Database["public"]["Tables"]["referral_outreach"]["Insert"];

const PAGE = 1000;

/**
 * Build (or refresh) the call roster for a campaign from synced Jobber data.
 * Criteria: client not archived, has a phone, and has >=1 job with
 * completed_at set. Existing rows are kept (unique on campaign+client), so
 * re-running only adds newly-eligible clients — call statuses are never reset.
 */
export async function buildRoster(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!campaignId) return { error: "Missing campaign", success: false };
  // include_all=true → every active client with a phone (use when Jobber jobs
  // aren't synced). Default → only clients with a completed job (the spec's
  // "past install clients").
  const includeAll = String(formData.get("include_all") ?? "") === "true";

  // 1. Build last-completed-job map (for enrichment + the default filter).
  const lastJobByClient = new Map<string, string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("jobber_jobs")
      .select("client_id, title, job_number, completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { error: `Jobs query failed: ${error.message}`, success: false };
    for (const j of data ?? []) {
      if (!j.client_id) continue;
      const when = j.completed_at
        ? new Date(j.completed_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : "";
      lastJobByClient.set(
        j.client_id,
        [j.title ?? (j.job_number ? `Job ${j.job_number}` : "Past job"), when].filter(Boolean).join(" — "),
      );
    }
    if (!data || data.length < PAGE) break;
  }

  const rows: OutreachInsert[] = [];
  const toRow = (c: { id: string; first_name: string | null; last_name: string | null; company_name: string | null; phones: unknown; emails: unknown }, phone: string): OutreachInsert => ({
    campaign_id: campaignId,
    jobber_client_id: c.id,
    client_name: clientDisplayName(c),
    client_phone: phone,
    client_email: primaryEmail(c.emails),
    last_job_note: lastJobByClient.get(c.id) ?? null,
    // Company-name-only records are usually B2B; callers can re-segment in UI.
    segment: !c.first_name && !c.last_name && c.company_name ? "b2b_partner" : "residential",
  });

  if (includeAll) {
    // 2a. Page through every active client; keep those with a phone.
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("jobber_clients")
        .select("id, first_name, last_name, company_name, phones, emails, is_archived")
        .eq("is_archived", false)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) return { error: `Clients query failed: ${error.message}`, success: false };
      for (const c of data ?? []) {
        const phone = primaryPhone(c.phones);
        if (phone) rows.push(toRow(c, phone));
      }
      if (!data || data.length < PAGE) break;
    }
  } else {
    // 2b. Default: only clients with a completed job.
    if (lastJobByClient.size === 0) {
      return {
        error: null,
        success: true,
        info: "No completed Jobber jobs are synced yet — so there are no 'past install' clients to build from. Run the Jobber jobs sync, or tick 'all active clients' to call your whole client list now.",
      };
    }
    const ids = [...lastJobByClient.keys()];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await supabase
        .from("jobber_clients")
        .select("id, first_name, last_name, company_name, phones, emails, is_archived")
        .in("id", chunk);
      if (error) return { error: `Clients query failed: ${error.message}`, success: false };
      for (const c of data ?? []) {
        if (c.is_archived) continue;
        const phone = primaryPhone(c.phones);
        if (phone) rows.push(toRow(c, phone));
      }
    }
  }

  // 3. Upsert, ignoring clients already on the roster.
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await supabase
      .from("referral_outreach")
      .upsert(chunk, { onConflict: "campaign_id,jobber_client_id", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: `Roster insert failed: ${error.message}`, success: false };
    added += data?.length ?? 0;
  }

  revalidatePath("/marketing/referrals");
  revalidatePath("/marketing");
  return {
    error: null,
    success: true,
    info: `Roster refreshed: ${added} client${added === 1 ? "" : "s"} added (${rows.length} eligible, existing rows untouched).`,
  };
}

const outcomeSchema = z.object({
  outreach_id: z.string().uuid(),
  call_status: z.enum(["no_answer", "declined", "referred", "do_not_call", "invalid_number", "queued"]),
  notes: z.string().max(2000).optional(),
});

/** Log a call outcome on a roster row (increments attempts, stamps time). */
export async function logCallOutcome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = outcomeSchema.safeParse({
    outreach_id: formData.get("outreach_id"),
    call_status: formData.get("call_status"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { data: row, error: readErr } = await supabase
    .from("referral_outreach")
    .select("attempts, notes")
    .eq("id", parsed.data.outreach_id)
    .single();
  if (readErr || !row) return { error: readErr?.message ?? "Roster row not found", success: false };

  const mergedNotes = [row.notes, parsed.data.notes].filter(Boolean).join("\n");
  const { error } = await supabase
    .from("referral_outreach")
    .update({
      call_status: parsed.data.call_status,
      attempts: row.attempts + (parsed.data.call_status === "queued" ? 0 : 1),
      last_called_at: parsed.data.call_status === "queued" ? null : new Date().toISOString(),
      notes: mergedNotes || null,
      owner_id: user.id,
    })
    .eq("id", parsed.data.outreach_id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/referrals");
  return { error: null, success: true };
}

const referralSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  outreach_id: z.string().uuid().optional(),
  referrer_jobber_client_id: z.string().optional(),
  referrer_name: z.string().min(1, "Referrer name is required"),
  source: z.enum(["call", "jobber_link", "word_of_mouth", "other"]).default("call"),
  referred_name: z.string().min(1, "Referred name is required"),
  referred_phone: z.string().optional(),
  referred_email: z.string().email().optional().or(z.literal("")),
  service_interest: z.string().optional(),
  notes: z.string().optional(),
});

/** Create a ledger entry. When tied to a roster row, marks that row 'referred'. */
export async function createReferral(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = referralSchema.safeParse({
    campaign_id: formData.get("campaign_id") || undefined,
    outreach_id: formData.get("outreach_id") || undefined,
    referrer_jobber_client_id: formData.get("referrer_jobber_client_id") || undefined,
    referrer_name: formData.get("referrer_name"),
    source: formData.get("source") || "call",
    referred_name: formData.get("referred_name"),
    referred_phone: formData.get("referred_phone") || undefined,
    referred_email: formData.get("referred_email") || undefined,
    service_interest: formData.get("service_interest") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  // Guard: self-referral (same phone on both sides) is not eligible.
  if (parsed.data.referred_phone && parsed.data.outreach_id) {
    const { data: outreachRow } = await supabase
      .from("referral_outreach")
      .select("client_phone")
      .eq("id", parsed.data.outreach_id)
      .single();
    const digits = (s: string) => s.replace(/\D/g, "");
    if (
      outreachRow?.client_phone &&
      digits(outreachRow.client_phone) === digits(parsed.data.referred_phone)
    ) {
      return {
        error: "Self-referrals aren't eligible (referrer and referred share a phone number).",
        success: false,
      };
    }
  }

  const { error } = await supabase.from("referrals").insert({
    campaign_id: parsed.data.campaign_id ?? null,
    outreach_id: parsed.data.outreach_id ?? null,
    referrer_jobber_client_id: parsed.data.referrer_jobber_client_id ?? null,
    referrer_name: parsed.data.referrer_name,
    source: parsed.data.source,
    referred_name: parsed.data.referred_name,
    referred_phone: parsed.data.referred_phone ?? null,
    referred_email: parsed.data.referred_email || null,
    service_interest: parsed.data.service_interest ?? null,
    notes: parsed.data.notes ?? null,
    created_by_id: user.id,
  });
  if (error) return { error: error.message, success: false };

  if (parsed.data.outreach_id) {
    const { data: row } = await supabase
      .from("referral_outreach")
      .select("attempts")
      .eq("id", parsed.data.outreach_id)
      .single();
    await supabase
      .from("referral_outreach")
      .update({
        call_status: "referred",
        attempts: (row?.attempts ?? 0) + 1,
        last_called_at: new Date().toISOString(),
        owner_id: user.id,
      })
      .eq("id", parsed.data.outreach_id);
  }

  revalidatePath("/marketing/referrals");
  revalidatePath("/marketing");
  return { error: null, success: true, info: "Referral added to the ledger." };
}

const stageSchema = z.object({
  referral_id: z.string().uuid(),
  stage: z.enum(["lead", "contacted", "quoted", "signed", "completed_paid", "lost"]),
});

/**
 * Move a referral through the funnel. Reward flip lives HERE (visible logic,
 * per spec §7.3): entering completed_paid with reward not_earned => due.
 */
export async function updateReferralStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = stageSchema.safeParse({
    referral_id: formData.get("referral_id"),
    stage: formData.get("stage"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { data: ref, error: readErr } = await supabase
    .from("referrals")
    .select("reward_status")
    .eq("id", parsed.data.referral_id)
    .single();
  if (readErr || !ref) return { error: readErr?.message ?? "Referral not found", success: false };

  const flipRewardDue = parsed.data.stage === "completed_paid" && ref.reward_status === "not_earned";
  const { error } = await supabase
    .from("referrals")
    .update({
      stage: parsed.data.stage,
      ...(flipRewardDue ? { reward_status: "due" as const } : {}),
    })
    .eq("id", parsed.data.referral_id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/referrals");
  revalidatePath("/marketing");
  return {
    error: null,
    success: true,
    info: flipRewardDue ? "Stage updated — reward is now DUE." : "Stage updated.",
  };
}

const rewardSchema = z.object({
  referral_id: z.string().uuid(),
  reward_type: z.enum(["visa_250", "care_plan_1yr", "undecided"]).optional(),
  mark_sent: z.coerce.boolean().optional(),
  override_status: z.enum(["not_earned", "due", "sent"]).optional(),
  reward_note: z.string().max(2000).optional(),
});

/**
 * Reward management. Normal path: set reward_type any time; mark_sent only
 * when status is 'due'. Admin override path: force any status, note required.
 */
export async function updateReward(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = rewardSchema.safeParse({
    referral_id: formData.get("referral_id"),
    reward_type: formData.get("reward_type") || undefined,
    mark_sent: formData.get("mark_sent") || undefined,
    override_status: formData.get("override_status") || undefined,
    reward_note: formData.get("reward_note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { data: ref, error: readErr } = await supabase
    .from("referrals")
    .select("reward_status")
    .eq("id", parsed.data.referral_id)
    .single();
  if (readErr || !ref) return { error: readErr?.message ?? "Referral not found", success: false };

  const update: Database["public"]["Tables"]["referrals"]["Update"] = {};
  if (parsed.data.reward_type) update.reward_type = parsed.data.reward_type;

  if (parsed.data.override_status) {
    // Admin-only override; RLS allows marketing too, so gate role explicitly.
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return { error: "Only admins can override reward status.", success: false };
    if (!parsed.data.reward_note?.trim()) return { error: "Override requires a note.", success: false };
    update.reward_status = parsed.data.override_status;
    update.reward_note = parsed.data.reward_note.trim();
    update.reward_sent_at = parsed.data.override_status === "sent" ? new Date().toISOString() : null;
  } else if (parsed.data.mark_sent) {
    if (ref.reward_status !== "due") {
      return { error: "Reward can only be marked sent when it is due (job completed + paid).", success: false };
    }
    update.reward_status = "sent";
    update.reward_sent_at = new Date().toISOString();
  }

  if (Object.keys(update).length === 0) return { error: "Nothing to update.", success: false };

  const { error } = await supabase.from("referrals").update(update).eq("id", parsed.data.referral_id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/referrals");
  revalidatePath("/marketing");
  return { error: null, success: true };
}

// ── AI ask-scripts (Marketing OS) ─────────────────────────────────────────────

export type ReferralScriptsResult = {
  error?: string;
  providerMissing?: boolean;
  scripts?: { phone_opener: string; sms: string; email_subject: string; email_body: string };
};

/** Generate phone/SMS/email referral-ask scripts from the program's real
 * reward facts. Logged to marketing_ai_generations. */
export async function aiGenerateReferralScripts(): Promise<ReferralScriptsResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Real program facts as shipped on this page — the AI must quote, not invent.
  const programFacts =
    "Referrer earns a $250 Visa gift card OR one year of the TexasTurf Care Plan, " +
    "earned when the referred job is completed and paid. The referred friend gets $100 off their job.";

  const { generateReferralScripts, logAiGeneration } = await import("@/lib/ai/marketing");
  const result = await generateReferralScripts(programFacts);
  if (!result.ok) {
    if (result.error === "provider_missing") return { providerMissing: true, error: result.message };
    return { error: result.message };
  }

  await logAiGeneration(supabase, {
    section: "referrals",
    generation_type: "referral_scripts",
    input: { program_facts: programFacts },
    output: result.data,
    created_by: user.id,
  });

  return { scripts: result.data };
}
