import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getJobProgress,
  JOB_PROGRESS_LABELS,
  JOB_PROGRESS_NEXT,
  type JobProgressState,
} from "@/lib/jobs/progress";
import { ProgressButtons } from "./progress-buttons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Install · TexasTurf OS" };

type Params = Promise<{ id: string }>;

type VisitDetail = {
  id: string;
  title: string | null;
  starts_at: string | null;
  ends_at:   string | null;
  is_complete: boolean;
  client: {
    company_name:  string | null;
    first_name:    string | null;
    last_name:     string | null;
    slack_channel_id: string | null;
  } | null;
};

type PullList = { id: string; address: string | null };

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function clientName(v: VisitDetail): string {
  if (!v.client) return "(no client)";
  return v.client.company_name
    ?? [v.client.first_name, v.client.last_name].filter(Boolean).join(" ")
    ?? "(no client)";
}

export default async function InstallPage({ params }: { params: Params }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Visit row (with client) — service-role since visits are mirror data.
  const sb = supabaseAdmin();
  const { data: visitRow, error: visitErr } = await sb
    .from("jobber_visits")
    .select(
      "id, title, starts_at, ends_at, is_complete, " +
      "client:client_id(company_name, first_name, last_name, slack_channel_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (visitErr) throw new Error(visitErr.message);
  if (!visitRow) notFound();
  const visit = visitRow as unknown as VisitDetail;

  // Find the matching pull list if there is one (the link is optional but
  // common — pull list is the warehouse-prep side, install is the field side).
  const { data: pullRow } = await sb
    .from("warehouse_pull_lists")
    .select("id, address")
    .eq("jobber_visit_id", id)
    .order("job_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pullList = pullRow as unknown as PullList | null;

  const { current, events } = await getJobProgress(id);
  const nextStates = JOB_PROGRESS_NEXT[current];
  const isTerminal = nextStates.length === 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/today" className="text-xs text-ink-3 hover:text-ink">
          ← Today
        </Link>
        <h1 className="mt-1 page-title">{clientName(visit)}</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          {fmtTime(visit.starts_at)}
          {visit.ends_at && <> → {fmtTime(visit.ends_at)}</>}
        </p>
        {visit.title && (
          <p className="mt-0.5 text-sm text-ink-2">{visit.title}</p>
        )}
        {pullList?.address && (
          <p className="mt-0.5 text-sm text-ink-3">📍 {pullList.address}</p>
        )}
      </div>

      {/* ─── Current state ───────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="text-xs uppercase tracking-wide text-ink-3">Current state</div>
        <div className="mt-1 text-xl font-semibold text-ink">
          {JOB_PROGRESS_LABELS[current]}
        </div>
        {!visit.client?.slack_channel_id && (
          <p className="mt-2 text-xs text-warn">
            No Slack channel linked for this client. State changes won&apos;t auto-post
            until <Link href="/operations/clients" className="underline">a channel is linked</Link>.
          </p>
        )}
      </div>

      {/* ─── Next-state buttons (mobile-friendly) ──────────────────── */}
      {isTerminal ? (
        <div className="rounded-xl border border-brand/30 bg-brand-tint p-5 text-center">
          <p className="text-sm font-medium text-brand">Job complete ✓</p>
          <p className="mt-1 text-xs text-brand">
            Final QA passed on {fmtTime(events[0]?.recorded_at ?? null)}.
          </p>
        </div>
      ) : (
        <ProgressButtons
          jobberVisitId={id}
          pullListId={pullList?.id ?? null}
          currentState={current}
          nextStates={nextStates}
        />
      )}

      {/* ─── Linked pull list ──────────────────────────────────────── */}
      {pullList && (
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-ink-3">Materials</div>
          <Link
            href={`/operations/pull-lists/${pullList.id}`}
            className="mt-1 inline-block text-sm font-medium text-ink underline-offset-2 hover:underline"
          >
            Open pull list →
          </Link>
        </div>
      )}

      {/* ─── Timeline ──────────────────────────────────────────────── */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold">Timeline</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">
            No events yet — tap a button above to record the first one.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {events.map((e) => {
              const who =
                e.recorded_by?.full_name?.trim()
                || e.recorded_by?.email?.split("@")[0]
                || "Unknown";
              return (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1 h-2 w-2 rounded-full bg-ink-4" />
                  <div className="flex-1">
                    <div className="font-medium text-ink">
                      {JOB_PROGRESS_LABELS[e.state as JobProgressState]}
                    </div>
                    <div className="text-xs text-ink-3">
                      {fmtTime(e.recorded_at)} · {who}
                    </div>
                    {e.notes && (
                      <p className="mt-1 text-xs text-ink-2">{e.notes}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
