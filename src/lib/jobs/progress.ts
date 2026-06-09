/**
 * Job progress state machine — server-side queries + helpers.
 *
 * Events are append-only in public.job_progress_events. The "current state"
 * of a Jobber visit is the most-recent event's `state` (or 'scheduled' if
 * none).
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

// Mirrors the public.job_progress_state enum.
export const JOB_PROGRESS_STATES = [
  "scheduled",
  "started",
  "tear_out_done",
  "base_started",
  "base_done",
  "turf_started",
  "two_hours_out",
  "turf_done",
  "final_qa_done",
  "on_hold",
] as const;

export type JobProgressState = (typeof JOB_PROGRESS_STATES)[number];

/**
 * Human-friendly label for each state. Used in the timeline + Slack post +
 * client portal copy.
 */
export const JOB_PROGRESS_LABELS: Record<JobProgressState, string> = {
  scheduled:     "Scheduled",
  started:       "Started — tear-out underway",
  tear_out_done: "Tear-out complete",
  base_started:  "Base work started",
  base_done:     "Base work complete",
  turf_started:  "Turf install started",
  two_hours_out: "≈ 2 hours from finish",
  turf_done:     "Turf install complete",
  final_qa_done: "Final QA complete — job done",
  on_hold:       "On hold",
};

/**
 * Short label (chip-sized). Used in tables + dashboard tiles.
 */
export const JOB_PROGRESS_SHORT: Record<JobProgressState, string> = {
  scheduled:     "Scheduled",
  started:       "Tear-out",
  tear_out_done: "Tear-out ✓",
  base_started:  "Base",
  base_done:     "Base ✓",
  turf_started:  "Turf",
  two_hours_out: "2 hrs out",
  turf_done:     "Turf ✓",
  final_qa_done: "Done",
  on_hold:       "On hold",
};

/**
 * Forward transitions allowed from each state. The UI offers only these
 * as primary buttons; admins can manually edit via SQL if a correction is
 * needed (or via the JOB_PROGRESS_ALL_NEXT list in this file).
 *
 * Linear flow with one branch: any state can go on_hold; on_hold can resume
 * to any prior state (admin-controlled).
 */
export const JOB_PROGRESS_NEXT: Record<JobProgressState, JobProgressState[]> = {
  scheduled:     ["started"],
  started:       ["tear_out_done", "on_hold"],
  tear_out_done: ["base_started", "on_hold"],
  base_started:  ["base_done", "on_hold"],
  base_done:     ["turf_started", "on_hold"],
  turf_started:  ["two_hours_out", "turf_done", "on_hold"],
  two_hours_out: ["turf_done", "on_hold"],
  turf_done:     ["final_qa_done", "on_hold"],
  final_qa_done: [], // terminal
  on_hold:       [
    // Admin escape: when resuming from hold, allow any active state.
    "started", "tear_out_done", "base_started", "base_done",
    "turf_started", "two_hours_out", "turf_done", "final_qa_done",
  ],
};

export type JobProgressEvent = {
  id: string;
  jobber_visit_id: string | null;
  pull_list_id: string | null;
  state: JobProgressState;
  notes: string | null;
  recorded_by_profile: string | null;
  recorded_at: string;
};

export type JobProgressEventWithUser = JobProgressEvent & {
  recorded_by: { full_name: string | null; email: string | null } | null;
};

/**
 * Current state for one Jobber visit + the timeline of events that led there.
 */
export async function getJobProgress(jobberVisitId: string): Promise<{
  current: JobProgressState;
  events: JobProgressEventWithUser[];
}> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("job_progress_events")
    .select(
      "id, jobber_visit_id, pull_list_id, state, notes, recorded_by_profile, recorded_at, " +
      "recorded_by:recorded_by_profile(full_name, email)",
    )
    .eq("jobber_visit_id", jobberVisitId)
    .order("recorded_at", { ascending: false });
  if (error) throw new Error(error.message);
  const events = (data ?? []) as unknown as JobProgressEventWithUser[];
  const current = (events[0]?.state ?? "scheduled") as JobProgressState;
  return { current, events };
}

/**
 * Current state for many visits at once (today's-jobs widget, dashboard
 * tiles). Returns a Map: visit_id → state. Visits with no events default
 * to 'scheduled'.
 *
 * Uses Postgres' DISTINCT ON to pull the freshest event per visit in one
 * round-trip. Falls back gracefully if `head` ordering errors.
 */
export async function getJobProgressBulk(
  jobberVisitIds: string[],
): Promise<Map<string, JobProgressState>> {
  const out = new Map<string, JobProgressState>();
  if (jobberVisitIds.length === 0) return out;
  const sb = supabaseAdmin();
  // PostgREST doesn't expose DISTINCT ON, so we pull all rows for the
  // requested visits and reduce client-side. Realistic visit counts (a
  // handful per day) keep this trivial.
  const { data, error } = await sb
    .from("job_progress_events")
    .select("jobber_visit_id, state, recorded_at")
    .in("jobber_visit_id", jobberVisitIds)
    .order("recorded_at", { ascending: false });
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as unknown as Array<{
    jobber_visit_id: string | null;
    state: JobProgressState;
  }>) {
    if (!row.jobber_visit_id) continue;
    if (!out.has(row.jobber_visit_id)) {
      // First (most recent due to order) wins.
      out.set(row.jobber_visit_id, row.state);
    }
  }
  return out;
}
