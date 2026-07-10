"use server";

/**
 * Server actions for job progress mutations.
 *
 * Append-only — we never UPDATE or DELETE events from this layer. State
 * corrections by an admin happen via direct SQL or a future admin tool.
 *
 * Role gate: admin / office / field can record events. The UI only shows
 * the next-state buttons to those roles (anon redirects to /login).
 */

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireOfficeOrAdmin } from "@/lib/auth/require-role";
import {
  JOB_PROGRESS_LABELS,
  JOB_PROGRESS_NEXT,
  JOB_PROGRESS_STATES,
  type JobProgressState,
} from "./progress";
import { pushClientNote } from "@/lib/jobber/push";

/**
 * Whitelist of OS user roles allowed to record a transition. We accept
 * 'field' here even though the standard requireOfficeOrAdmin helper does
 * not — the whole point of this feature is field workers tapping from a
 * phone.
 */
async function requireFieldEligible() {
  // require-role exposes admin/office helpers; here we resolve manually so
  // 'field' is accepted too.
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  if (!role || !["admin", "office", "field"].includes(role)) {
    throw new Error("Not authorized to update job progress");
  }
  return { userId: user.id, role };
}

/**
 * Record a state transition for a Jobber visit. The state machine is enforced
 * here, not in the DB: if you try to skip from `scheduled` straight to
 * `turf_done`, you get an error. The exception is `on_hold` — always allowed
 * — and resume-from-hold (any forward state allowed).
 */
export async function recordJobProgress(formData: FormData) {
  const { userId } = await requireFieldEligible();

  const jobberVisitId = String(formData.get("jobber_visit_id") ?? "").trim();
  if (!jobberVisitId) throw new Error("Jobber visit id is required");

  const next = String(formData.get("state") ?? "").trim() as JobProgressState;
  if (!JOB_PROGRESS_STATES.includes(next)) {
    throw new Error(`Unknown state: ${next}`);
  }

  const pullListId = nullableString(formData.get("pull_list_id"));
  const notes      = nullableString(formData.get("notes"));

  const sb = supabaseAdmin();

  // Look up current state to enforce allowed transitions. First-event
  // implicit start state is 'scheduled'.
  const { data: latest, error: readErr } = await sb
    .from("job_progress_events")
    .select("state")
    .eq("jobber_visit_id", jobberVisitId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  const current = ((latest as { state?: JobProgressState } | null)?.state
    ?? "scheduled") as JobProgressState;

  const allowed = JOB_PROGRESS_NEXT[current];
  if (!allowed.includes(next) && next !== current) {
    throw new Error(
      `Cannot move from "${current}" to "${next}". ` +
      `Allowed next: ${allowed.length === 0 ? "(terminal)" : allowed.join(", ")}.`,
    );
  }

  const { error: insErr } = await sb
    .from("job_progress_events")
    .insert({
      jobber_visit_id:     jobberVisitId,
      pull_list_id:        pullListId,
      state:               next,
      notes,
      recorded_by_profile: userId,
    });
  if (insErr) throw new Error(insErr.message);

  // Two-way sync: mirror the transition into Jobber as a client note so the
  // office sees OS-side install progress without leaving Jobber. Fire-and-
  // forget — a push failure (scope, throttle, outage) never blocks the tap.
  void (async () => {
    const { data: visit } = await sb
      .from("jobber_visits")
      .select("client_id, title")
      .eq("id", jobberVisitId)
      .maybeSingle();
    if (!visit?.client_id) return;
    const { data: actor } = await sb
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const who = actor?.full_name ?? actor?.email ?? "TexasTurf OS";
    const label = JOB_PROGRESS_LABELS[next] ?? next;
    const lines = [
      `TexasTurf OS — install progress: ${label}`,
      visit.title ? `Visit: ${visit.title}` : null,
      notes ? `Notes: ${notes}` : null,
      `By ${who}`,
    ].filter(Boolean);
    await pushClientNote(visit.client_id, lines.join("\n"));
  })().catch(() => {
    // pushClientNote already reports to Sentry; nothing more to do here.
  });

  // Phase A1 stops here — Slack post + email come in A2/A3.
  // Cache invalidation: the install page, today list, dashboard tiles, and
  // pull list (if linked) all read from this table.
  revalidatePath(`/install/${jobberVisitId}`);
  revalidatePath("/today");
  revalidatePath("/dashboard");
  if (pullListId) revalidatePath(`/operations/pull-lists/${pullListId}`);
}

/**
 * Admin-only correction: when a transition was tapped wrong, an admin can
 * append a "rewind" event by manually picking any state. Bypasses the
 * forward-only state-machine guard.
 */
export async function adminForceJobProgress(formData: FormData) {
  await requireOfficeOrAdmin(); // tighter — office or admin only
  const jobberVisitId = String(formData.get("jobber_visit_id") ?? "").trim();
  if (!jobberVisitId) throw new Error("Jobber visit id is required");
  const next = String(formData.get("state") ?? "").trim() as JobProgressState;
  if (!JOB_PROGRESS_STATES.includes(next)) {
    throw new Error(`Unknown state: ${next}`);
  }
  const notes = nullableString(formData.get("notes"));

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("job_progress_events")
    .insert({
      jobber_visit_id:     jobberVisitId,
      state:               next,
      notes:               notes ?? "[admin correction]",
      recorded_by_profile: user?.id ?? null,
    });
  if (error) throw new Error(error.message);
  revalidatePath(`/install/${jobberVisitId}`);
}

function nullableString(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}
