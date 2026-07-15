import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { transcribeMedia, CALL_TRANSCRIBE_MODEL } from "@/lib/ai/transcribe";
import { reviewCallTranscript, CALL_REVIEW_MODEL, type CallReview } from "@/lib/ai/calls";
import { publicBaseUrl } from "@/lib/twilio/client";
import type { CallRow } from "@/lib/db-helpers.types";

/**
 * Recording-ready pipeline (calling suite Phase 3), fired from the
 * recording-status webhook via after(): download the recording, transcribe
 * (OpenAI, gpt-4o-mini-transcribe — half whisper-1's per-minute cost), run
 * the Claude call reviewer, and turn its follow_up_actions into real `tasks`
 * rows assigned to the caller. Runs for ALL recorded calls, both brands.
 *
 * SERVICE CLIENT justification (AGENTS.md §6): this runs in webhook context
 * with no user session — the same trusted-server posture as the other Twilio
 * routes. Nothing here is reachable from user input; the webhook is
 * signature-validated before this is scheduled.
 *
 * Idempotency: call_ai_reviews is UNIQUE(call_id) and the insert is
 * ON CONFLICT DO NOTHING — a webhook retry can re-transcribe at worst, it can
 * never double-review or duplicate follow-up tasks.
 */
export async function processRecordingReady(callSid: string): Promise<void> {
  const sb = createServiceClient();

  try {
    const { data } = await sb
      .from("calls")
      .select("*")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();
    const call = data as CallRow | null;
    if (!call?.recording_url) return;

    // Already reviewed → webhook retry, nothing to do.
    const { data: existing } = await sb
      .from("call_ai_reviews")
      .select("id")
      .eq("call_id", call.id)
      .maybeSingle();
    if (existing) return;

    // 1. Transcript (reuse if a retry already stored one).
    let transcript = call.transcript;
    if (!transcript) {
      transcript = await fetchAndTranscribe(call);
      if (!transcript) return; // failure already reported to Sentry
      await sb
        .from("calls")
        .update({ transcript, transcribed_at: new Date().toISOString() })
        .eq("id", call.id);
    }

    // 2. AI review.
    const meta = await gatherMeta(sb, call);
    const result = await reviewCallTranscript(transcript, meta);
    if (!result.ok) {
      Sentry.captureMessage(`call review failed: ${result.message}`, {
        level: "error",
        tags: { feature: "calls", stage: "review" },
        extra: { callId: call.id },
      });
      return;
    }
    const { review, tokensInput, tokensOutput } = result.data;

    // 3. Persist the review — the conflict target is the idempotency gate.
    const { data: inserted, error: insertError } = await sb
      .from("call_ai_reviews")
      .upsert(
        {
          call_id: call.id,
          summary: review.summary,
          outcome_class: review.outcome_class,
          interest_level: review.interest_level,
          objections: review.objections,
          commitments: review.commitments,
          coaching_notes: review.coaching_notes.length
            ? review.coaching_notes.map((n) => `• ${n}`).join("\n")
            : null,
          follow_ups: review.follow_up_actions,
          model: CALL_REVIEW_MODEL,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
        },
        { onConflict: "call_id", ignoreDuplicates: true },
      )
      .select("id");
    if (insertError) throw insertError;
    if (!inserted?.length) return; // lost the race to a concurrent retry

    // 4. Follow-ups become real tasks, assigned to the caller.
    await createFollowUpTasks(sb, call, review);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: "calls", stage: "pipeline" },
      extra: { callSid },
    });
  }
}

async function fetchAndTranscribe(call: CallRow): Promise<string | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken || !call.recording_url) return null;

  const media = await fetch(`${call.recording_url}.mp3`, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
    },
  });
  if (!media.ok) {
    Sentry.captureMessage(`recording download failed (${media.status})`, {
      level: "error",
      tags: { feature: "calls", stage: "download" },
      extra: { callId: call.id },
    });
    return null;
  }
  const blob = await media.blob();

  const result = await transcribeMedia(blob, `call-${call.id}.mp3`, CALL_TRANSCRIBE_MODEL);
  if (!result.ok) {
    Sentry.captureMessage(`call transcription failed: ${result.message}`, {
      level: "error",
      tags: { feature: "calls", stage: "transcribe" },
      extra: { callId: call.id },
    });
    return null;
  }
  return result.text;
}

async function gatherMeta(
  sb: ReturnType<typeof createServiceClient>,
  call: CallRow,
) {
  const [repRes, attemptsRes, listRes] = await Promise.all([
    sb.from("profiles").select("full_name").eq("id", call.caller_id).maybeSingle(),
    call.target_id
      ? sb
          .from("call_attempts")
          .select("outcome, created_at")
          .eq("target_type", call.target_type ?? "")
          .eq("target_id", call.target_id)
          .not("outcome", "is", null)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null }),
    call.call_attempt_id
      ? sb
          .from("call_attempts")
          .select("call_list_id, call_lists(name, description)")
          .eq("id", call.call_attempt_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const priorOutcomes = ((attemptsRes.data ?? []) as { outcome: string | null }[])
    .map((a) => a.outcome)
    .filter(Boolean)
    .join(", ");
  const listRow = listRes.data as
    | { call_lists: { name: string; description: string | null } | null }
    | null;
  const listContext = listRow?.call_lists
    ? [listRow.call_lists.name, listRow.call_lists.description].filter(Boolean).join(" — ")
    : null;

  // Company only rides on sales contacts; dialer snapshots carry it for
  // Jobber/TurfCasa targets, but the calls row stores name+phone only.
  let contactCompany: string | null = null;
  if (call.target_type === "sales_contact" && call.target_id) {
    const { data: contact } = await sb
      .from("sales_contacts")
      .select("company")
      .eq("id", call.target_id)
      .maybeSingle();
    contactCompany = (contact as { company: string | null } | null)?.company ?? null;
  }

  return {
    brand: call.brand,
    repName: (repRes.data as { full_name: string | null } | null)?.full_name ?? null,
    contactName: call.target_name,
    contactCompany,
    listContext,
    priorOutcomes: priorOutcomes || null,
  };
}

const PRIORITY_MAP: Record<CallReview["follow_up_actions"][number]["priority"], string> = {
  low: "low",
  medium: "normal",
  high: "high",
};

async function createFollowUpTasks(
  sb: ReturnType<typeof createServiceClient>,
  call: CallRow,
  review: CallReview,
): Promise<void> {
  if (!review.follow_up_actions.length) return;

  const callUrl = `${publicBaseUrl()}/sales/calls/${call.id}`;
  const today = new Date();

  for (const action of review.follow_up_actions) {
    const due = new Date(today);
    due.setDate(due.getDate() + action.due_in_days);

    const { error } = await sb.from("tasks").insert({
      title: action.title,
      description: `${action.description}\n\nFrom AI call review: ${callUrl}`,
      priority: PRIORITY_MAP[action.priority] as "low" | "normal" | "high",
      status: "inbox",
      due_date: due.toISOString().slice(0, 10),
      assignee_id: call.caller_id, // DB trigger mirrors this into task_assignees
      created_by_id: call.caller_id,
      // Identifiable as call-generated + traceable to the exact call.
      tags: ["call-followup", `call:${call.id}`],
    });
    if (error) {
      Sentry.captureException(error, {
        tags: { feature: "calls", stage: "create-task" },
        extra: { callId: call.id, title: action.title },
      });
    }
  }

  // One in-app notification so the rep sees the batch land.
  try {
    await sb.from("notifications").insert({
      user_id: call.caller_id,
      type: "task_assigned",
      title: `AI call review created ${review.follow_up_actions.length} follow-up task${review.follow_up_actions.length === 1 ? "" : "s"}`,
      body: review.summary.slice(0, 200),
      resource_type: "call",
      resource_id: call.id,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: "calls", stage: "notify" },
      extra: { callId: call.id },
    });
  }
}
