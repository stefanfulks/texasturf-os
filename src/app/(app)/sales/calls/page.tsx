import Link from "next/link";
import { redirect } from "next/navigation";
import { Mic, PhoneCall, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRecentCalls } from "@/lib/calls/queries";
import { OUTCOME_CLASS_LABELS, interestChipClass } from "@/lib/calls/labels";

export const dynamic = "force-dynamic";

/**
 * Calls list (calling suite Phase 3): every recorded call, both brands, with
 * the AI review's interest level + outcome class as chips. Brand filter via
 * ?brand=texasturf|turfcasa.
 */
export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { brand } = await searchParams;
  const brandFilter =
    brand === "texasturf" || brand === "turfcasa" ? brand : undefined;
  const calls = await getRecentCalls({ brand: brandFilter });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1 flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5" aria-hidden />
            Sales · Calls
          </p>
          <h1 className="page-title">Recorded calls</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-2">
            Every dialer and deal-page call, recorded and AI-reviewed. Follow-up
            actions become tasks automatically.
          </p>
        </div>
        <Link href="/sales/dialer" className="btn">
          <PhoneCall className="h-4 w-4" aria-hidden /> Open dialer
        </Link>
      </div>

      <div className="flex items-center gap-1.5">
        {[
          { label: "All", href: "/sales/calls", active: !brandFilter },
          { label: "TexasTurf", href: "/sales/calls?brand=texasturf", active: brandFilter === "texasturf" },
          { label: "TurfCasa", href: "/sales/calls?brand=turfcasa", active: brandFilter === "turfcasa" },
        ].map((f) => (
          <Link key={f.label} href={f.href} className={`chip ${f.active ? "bg-ink text-white" : ""}`}>
            {f.label}
          </Link>
        ))}
      </div>

      {!calls.length ? (
        <div className="panel">
          <div className="empty-state">
            <span className="medallion medallion-brand">
              <Mic className="h-5 w-5" />
            </span>
            <p className="empty-state-title">No recorded calls yet</p>
            <p className="empty-state-body">
              Place a call from the dialer or a deal page — the recording,
              transcript, and AI review land here automatically.
            </p>
          </div>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="px-4 py-2.5 font-semibold">Who</th>
                <th className="px-4 py-2.5 font-semibold">Rep</th>
                <th className="px-4 py-2.5 font-semibold">When</th>
                <th className="px-4 py-2.5 font-semibold">Length</th>
                <th className="px-4 py-2.5 font-semibold">AI review</th>
                <th className="px-4 py-2.5 font-semibold">Interest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {calls.map((c) => (
                <tr key={c.id} className="hover:bg-sunken">
                  <td className="px-4 py-2.5">
                    <Link href={`/sales/calls/${c.id}`} className="font-medium text-ink hover:underline">
                      {c.target_name ?? c.target_phone ?? "Unknown"}
                    </Link>
                    {c.brand === "turfcasa" && (
                      <span className="chip chip-warn ml-2 inline-flex items-center gap-1 text-[10px]">
                        <Store className="h-2.5 w-2.5" aria-hidden /> TC
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{c.callerName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-2">
                    {new Date(c.started_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="num px-4 py-2.5 text-ink-2">
                    {c.duration_sec ? `${Math.floor(c.duration_sec / 60)}m${(c.duration_sec % 60).toString().padStart(2, "0")}s` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {c.review ? (
                      <span className="chip text-xs">
                        {OUTCOME_CLASS_LABELS[c.review.outcome_class] ?? c.review.outcome_class}
                      </span>
                    ) : c.recording_status === "completed" ? (
                      <span className="text-xs text-ink-3">reviewing…</span>
                    ) : (
                      <span className="text-xs text-ink-3">{c.recording_status ?? "no recording"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {c.review ? (
                      <span className={`chip text-xs ${interestChipClass(c.review.interest_level)}`}>
                        {c.review.interest_level} / 5
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
