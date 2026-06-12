import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getJobProgressBulk,
  JOB_PROGRESS_SHORT,
  type JobProgressState,
} from "@/lib/jobs/progress";

const STATE_TONE: Record<JobProgressState, string> = {
  scheduled:     "bg-sunken text-ink-2",
  started:       "bg-warn-tint text-warn",
  tear_out_done: "bg-warn-tint text-warn",
  base_started:  "bg-info-tint text-info",
  base_done:     "bg-info-tint text-info",
  turf_started:  "bg-info-tint text-info",
  two_hours_out: "bg-warn-tint text-warn",
  turf_done:     "bg-info-tint text-info",
  final_qa_done: "bg-brand-tint text-brand",
  on_hold:       "bg-danger-tint text-danger",
};

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const sb = await createClient();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data: visits, error } = await sb
    .from("jobber_visits")
    .select("id, title, starts_at, ends_at, is_complete, client_id, assigned_user_ids")
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .order("starts_at", { ascending: true });

  const clientIds = [...new Set((visits ?? []).map((v) => v.client_id).filter(Boolean) as string[])];
  const { data: clients } = clientIds.length
    ? await sb
        .from("jobber_clients")
        .select("id, company_name, first_name, last_name")
        .in("id", clientIds)
    : { data: [] };
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));

  // Pull the most-recent job progress state per visit so each row shows where
  // its install actually is right now (not just "scheduled" from Jobber).
  const visitIds = (visits ?? []).map((v) => v.id);
  const progressMap = visitIds.length > 0
    ? await getJobProgressBulk(visitIds)
    : new Map<string, JobProgressState>();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold">
          Today —{" "}
          {start.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </h1>
        <Link href="/calendar" className="text-sm text-ink-3 hover:underline shrink-0">
          Calendar →
        </Link>
      </div>

      {error && (
        <p className="mt-6 rounded-md border border-danger/30 bg-danger-tint p-3 text-sm text-danger">
          {error.message}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {(visits ?? []).map((v) => {
          const c = v.client_id ? clientMap.get(v.client_id) : null;
          const clientName =
            c?.company_name ??
            [c?.first_name, c?.last_name].filter(Boolean).join(" ") ??
            "—";
          const state = progressMap.get(v.id) ?? "scheduled";
          return (
            <Link
              key={v.id}
              href={`/install/${v.id}`}
              className="flex items-center gap-3 sm:gap-4 rounded-lg border border-line bg-white p-3 sm:p-4 hover:border-line-strong active:bg-hover transition-colors"
            >
              <div className="w-14 sm:w-20 text-xs sm:text-sm tabular-nums text-ink-3 shrink-0">
                {v.starts_at
                  ? new Date(v.starts_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : ""}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm sm:text-base font-medium truncate">
                  {v.title || clientName}
                </div>
                <div className="text-xs sm:text-sm text-ink-3 truncate">{clientName}</div>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium " +
                  STATE_TONE[state]
                }
              >
                {JOB_PROGRESS_SHORT[state]}
              </span>
              <div className="hidden sm:block text-xs text-ink-3">
                {v.assigned_user_ids?.length ?? 0} assigned
              </div>
              {v.is_complete && (
                <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] sm:text-xs text-brand">
                  jobber ✓
                </span>
              )}
            </Link>
          );
        })}
        {(!visits || visits.length === 0) && !error && (
          <div className="rounded-lg border border-dashed border-line-strong p-10 text-center text-ink-3">
            <p className="text-sm">No visits synced for today.</p>
            <p className="mt-1 text-xs">
              If you expected something here, sync Jobber from
              {" "}
              <Link href="/settings/jobber" className="underline">
                settings
              </Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
