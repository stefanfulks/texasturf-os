import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, MessageSquareQuote, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCoachingData } from "@/lib/calls/coaching";
import { OUTCOME_CLASS_LABELS, interestChipClass } from "@/lib/calls/labels";

export const dynamic = "force-dynamic";

/**
 * Coaching view (calling suite Phase 4) — for Stefan/Clay: rep talk-track
 * stats, objection themes rolled up across calls, and recent reviewed calls.
 * One page, 30-day window.
 */
export default async function CoachingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { repStats, objectionThemes, recentCalls } = await getCoachingData();

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden />
          Sales · Coaching
        </p>
        <h1 className="page-title">Call coaching</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-2">
          Last 30 days of recorded calls, AI-reviewed: who&apos;s dialing, what
          customers push back on, and where each rep&apos;s talk track stands.
        </p>
      </div>

      {/* Rep talk-track stats */}
      <div className="panel overflow-x-auto">
        <div className="panel-head">
          <p className="text-sm font-semibold text-ink">Rep stats — 30 days</p>
        </div>
        {repStats.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="px-4 py-2.5 font-semibold">Rep</th>
                <th className="px-4 py-2.5 font-semibold">Calls</th>
                <th className="px-4 py-2.5 font-semibold">Connected</th>
                <th className="px-4 py-2.5 font-semibold">Avg interest</th>
                <th className="px-4 py-2.5 font-semibold">Avg length</th>
                <th className="px-4 py-2.5 font-semibold">Follow-ups created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {repStats.map((r) => (
                <tr key={r.repId}>
                  <td className="px-4 py-2.5 font-medium text-ink">{r.repName}</td>
                  <td className="num px-4 py-2.5">{r.calls}</td>
                  <td className="num px-4 py-2.5">
                    {r.connected}
                    <span className="text-xs text-ink-3">
                      {" "}
                      ({r.calls ? Math.round((r.connected / r.calls) * 100) : 0}%)
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.avgInterest !== null ? (
                      <span className={`chip text-xs ${interestChipClass(Math.round(r.avgInterest))}`}>
                        {r.avgInterest} / 5
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">—</span>
                    )}
                  </td>
                  <td className="num px-4 py-2.5">
                    {r.avgDurationSec
                      ? `${Math.floor(r.avgDurationSec / 60)}m${(r.avgDurationSec % 60).toString().padStart(2, "0")}s`
                      : "—"}
                  </td>
                  <td className="num px-4 py-2.5">{r.followUpTasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-3 text-sm text-ink-3">
            No recorded calls in the last 30 days yet.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Objection themes */}
        <div className="panel">
          <div className="panel-head">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <MessageSquareQuote className="h-4 w-4" aria-hidden /> Objection themes
            </p>
          </div>
          {objectionThemes.length ? (
            <ul className="divide-y divide-line">
              {objectionThemes.map((t) => (
                <li key={t.theme} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-ink">{t.theme}</span>
                    <span className="chip chip-neutral text-xs">×{t.count}</span>
                  </div>
                  {t.quotes[0] && (
                    <blockquote className="mt-1 border-l-2 border-line pl-2 text-xs text-ink-2">
                      &ldquo;{t.quotes[0]}&rdquo;
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-3">
              Objections the AI hears will roll up here.
            </p>
          )}
        </div>

        {/* Recent reviewed calls */}
        <div className="panel">
          <div className="panel-head flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Recent calls</p>
            <Link href="/sales/calls" className="text-xs font-medium text-ink-3 hover:text-ink">
              View all
            </Link>
          </div>
          {recentCalls.length ? (
            <ul className="max-h-[30rem] divide-y divide-line overflow-y-auto">
              {recentCalls.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/sales/calls/${c.id}`}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-sunken"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate font-medium text-ink">
                        {c.target_name ?? c.target_phone ?? "Unknown"}
                        {c.brand === "turfcasa" && (
                          <Store className="h-3 w-3 shrink-0 text-warn" aria-hidden />
                        )}
                      </span>
                      <span className="block truncate text-xs text-ink-3">
                        {c.callerName ?? "—"} ·{" "}
                        {c.review
                          ? OUTCOME_CLASS_LABELS[c.review.outcome_class] ?? c.review.outcome_class
                          : c.recording_status ?? "no recording"}
                      </span>
                    </span>
                    {c.review && (
                      <span className={`chip shrink-0 text-xs ${interestChipClass(c.review.interest_level)}`}>
                        {c.review.interest_level}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-3">No calls yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
