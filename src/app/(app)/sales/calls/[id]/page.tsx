import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckSquare,
  GraduationCap,
  MessageSquareQuote,
  Mic,
  Sparkles,
  Store,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCallDetail } from "@/lib/calls/queries";
import { OUTCOME_CLASS_LABELS, interestChipClass } from "@/lib/calls/labels";
import { OUTCOME_LABELS, type CallOutcome } from "@/lib/dialer/types";

export const dynamic = "force-dynamic";

type Objection = { objection: string; quote: string };
type Commitment = { who: "rep" | "customer"; commitment: string; quote: string };

/** Call detail (calling suite Phase 3): player + transcript + AI review +
 * the tasks it created. */
export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const detail = await getCallDetail(id);
  if (!detail) notFound();
  const { call, review, callerName, tasks } = detail;

  const objections = ((review?.objections ?? []) as Objection[]).filter(Boolean);
  const commitments = ((review?.commitments ?? []) as Commitment[]).filter(Boolean);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/sales/calls"
          className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All calls
        </Link>
        <h1 className="page-title flex flex-wrap items-center gap-2">
          <Mic className="h-5 w-5 text-brand" aria-hidden />
          {call.target_name ?? call.target_phone ?? "Unknown"}
          {call.brand === "turfcasa" && (
            <span className="chip chip-warn inline-flex items-center gap-1 text-xs">
              <Store className="h-3 w-3" aria-hidden /> TurfCasa
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          {callerName ?? "Unknown rep"} ·{" "}
          {new Date(call.started_at).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          {call.duration_sec
            ? ` · ${Math.floor(call.duration_sec / 60)}m${(call.duration_sec % 60).toString().padStart(2, "0")}s`
            : ""}
          {call.outcome
            ? ` · logged: ${OUTCOME_LABELS[call.outcome as CallOutcome] ?? call.outcome}`
            : ""}
        </p>
      </div>

      {/* Player */}
      <div className="panel p-4">
        {call.recording_url && call.recording_status === "completed" ? (
          <audio controls preload="none" className="w-full" src={`/api/calls/${call.id}/recording`} />
        ) : (
          <p className="text-sm text-ink-3">
            {call.recording_status
              ? `Recording ${call.recording_status}…`
              : "No recording for this call."}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {/* AI review */}
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Sparkles className="h-4 w-4 text-brand" aria-hidden /> AI review
              </p>
              {review && (
                <>
                  <span className="chip text-xs">
                    {OUTCOME_CLASS_LABELS[review.outcome_class] ?? review.outcome_class}
                  </span>
                  <span className={`chip text-xs ${interestChipClass(review.interest_level)}`}>
                    Interest {review.interest_level} / 5
                  </span>
                </>
              )}
            </div>
            {review ? (
              <p className="text-sm leading-relaxed text-ink">{review.summary}</p>
            ) : (
              <p className="text-sm text-ink-3">
                {call.recording_status === "completed"
                  ? "Review pending — it lands a minute or two after the recording."
                  : "The AI review runs once a recording completes."}
              </p>
            )}
          </div>

          {objections.length > 0 && (
            <div className="panel p-5">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <MessageSquareQuote className="h-4 w-4" aria-hidden /> Objections
              </p>
              <ul className="space-y-2">
                {objections.map((o, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-ink">{o.objection}</span>
                    <blockquote className="mt-0.5 border-l-2 border-line pl-2 text-ink-2">
                      &ldquo;{o.quote}&rdquo;
                    </blockquote>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {commitments.length > 0 && (
            <div className="panel p-5">
              <p className="mb-2 text-sm font-semibold text-ink">Commitments</p>
              <ul className="space-y-2">
                {commitments.map((c, i) => (
                  <li key={i} className="text-sm">
                    <span className="chip chip-neutral mr-1.5 text-[10px] uppercase">{c.who}</span>
                    <span className="text-ink">{c.commitment}</span>
                    <blockquote className="mt-0.5 border-l-2 border-line pl-2 text-ink-2">
                      &ldquo;{c.quote}&rdquo;
                    </blockquote>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {review?.coaching_notes && (
            <div className="panel p-5">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <GraduationCap className="h-4 w-4" aria-hidden /> Coaching
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">
                {review.coaching_notes}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Created tasks */}
          <div className="panel">
            <div className="panel-head">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <CheckSquare className="h-4 w-4" aria-hidden /> Follow-up tasks
              </p>
            </div>
            {tasks.length ? (
              <ul className="divide-y divide-line">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/tasks?task=${t.id}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-sunken"
                    >
                      <span className="min-w-0 truncate font-medium text-ink">{t.title}</span>
                      <span className="chip chip-neutral shrink-0 text-[10px]">
                        {t.due_date ?? t.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-ink-3">
                None yet — tasks appear when the AI review finds follow-ups.
              </p>
            )}
          </div>

          {/* Transcript */}
          <div className="panel">
            <div className="panel-head">
              <p className="text-sm font-semibold text-ink">Transcript</p>
            </div>
            <div className="max-h-[32rem] overflow-y-auto px-4 py-3">
              {call.transcript ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">
                  {call.transcript}
                </p>
              ) : (
                <p className="text-sm text-ink-3">No transcript yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
