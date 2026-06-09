import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getJobProgressBulk,
  JOB_PROGRESS_SHORT,
  type JobProgressState,
} from "@/lib/jobs/progress";

const STATE_TONE: Record<JobProgressState, string> = {
  scheduled:     "bg-zinc-100 text-zinc-700",
  started:       "bg-amber-100 text-amber-800",
  tear_out_done: "bg-amber-100 text-amber-800",
  base_started:  "bg-blue-100 text-blue-800",
  base_done:     "bg-blue-100 text-blue-800",
  turf_started:  "bg-violet-100 text-violet-800",
  two_hours_out: "bg-orange-100 text-orange-900",
  turf_done:     "bg-violet-100 text-violet-800",
  final_qa_done: "bg-green-100 text-green-800",
  on_hold:       "bg-red-100 text-red-800",
};

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const sb = supabaseAdmin();

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
        <Link href="/calendar" className="text-sm text-zinc-500 hover:underline shrink-0">
          Calendar →
        </Link>
      </div>

      {error && (
        <p className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
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
              className="flex items-center gap-3 sm:gap-4 rounded-lg border border-zinc-200 bg-white p-3 sm:p-4 hover:border-zinc-400 active:bg-zinc-50 transition-colors"
            >
              <div className="w-14 sm:w-20 text-xs sm:text-sm tabular-nums text-zinc-500 shrink-0">
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
                <div className="text-xs sm:text-sm text-zinc-500 truncate">{clientName}</div>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium " +
                  STATE_TONE[state]
                }
              >
                {JOB_PROGRESS_SHORT[state]}
              </span>
              <div className="hidden sm:block text-xs text-zinc-500">
                {v.assigned_user_ids?.length ?? 0} assigned
              </div>
              {v.is_complete && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] sm:text-xs text-green-800">
                  jobber ✓
                </span>
              )}
            </Link>
          );
        })}
        {(!visits || visits.length === 0) && !error && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
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
