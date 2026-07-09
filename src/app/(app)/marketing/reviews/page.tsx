import { redirect } from "next/navigation";
import { AlertTriangle, Star, Send, CheckCircle2, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { LucideIcon } from "lucide-react";
import { ReviewTable, BuildReviewListButton } from "./review-table";
import { AskGenerator } from "./ask-generator";

export type ReviewRow = Database["public"]["Tables"]["review_outreach"]["Row"];

const STATUSES = ["pending", "requested", "received", "declined"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "To ask",
  requested: "Requested",
  received: "Received",
  declined: "Declined",
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const countsRes = await Promise.all(
    STATUSES.map((s) =>
      supabase.from("review_outreach").select("id", { count: "exact", head: true }).eq("status", s),
    ),
  );
  const tableError = countsRes.find((r) => r.error)?.error;
  if (tableError) {
    return (
      <div className="space-y-5">
        <div>
          <p className="eyebrow mb-2">Marketing</p>
          <h1 className="page-title">Reviews</h1>
        </div>
        <div className="panel">
          <div className="empty-state">
            <span className="medallion medallion-warn">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <p className="empty-state-title">Reviews table isn&rsquo;t set up yet</p>
            <p className="empty-state-body">Apply the marketing_reviews migration, then reload this page.</p>
          </div>
        </div>
      </div>
    );
  }
  const counts = Object.fromEntries(STATUSES.map((s, i) => [s, countsRes[i].count ?? 0])) as Record<(typeof STATUSES)[number], number>;

  // This-month received (response signal).
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartISO = monthStart.toISOString();
  const receivedThisMonthRes = await supabase
    .from("review_outreach")
    .select("id", { count: "exact", head: true })
    .eq("status", "received")
    .gte("received_at", monthStartISO);
  const receivedThisMonth = receivedThisMonthRes.count ?? 0;

  const asked = counts.requested + counts.received + counts.declined;
  const responseRate = asked > 0 ? Math.round((counts.received / asked) * 100) : 0;

  let query = supabase
    .from("review_outreach")
    .select("*")
    .order("completed_on", { ascending: false, nullsFirst: false })
    .limit(300);
  if (status && (STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status as (typeof STATUSES)[number]);
  }
  const { data: rows } = await query;

  const tiles: Array<{ label: string; value: string | number; icon: LucideIcon; accent: string; urgent?: boolean }> = [
    { label: "To ask", value: counts.pending, icon: Star, accent: counts.pending > 0 ? "stat-accent-warn" : "", urgent: counts.pending > 0 },
    { label: "Requested", value: counts.requested, icon: Send, accent: "" },
    { label: "Received this month", value: receivedThisMonth, icon: CheckCircle2, accent: "stat-accent-brand" },
    { label: "Response rate", value: `${responseRate}%`, icon: Percent, accent: "" },
  ];

  return (
    <div className="space-y-6">
      <header className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Marketing</p>
          <h1 className="page-title">Reviews</h1>
          <p className="page-sub">
            Ask completed-job clients for a review — the local-SEO lever. Build the
            list, send via Jobber or text, and track where it lands.
          </p>
        </div>
        <BuildReviewListButton />
      </header>

      <div className="reveal grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className={`stat ${t.accent}`}>
              <div className="flex items-start justify-between">
                <span className="stat-label">{t.label}</span>
                <span className={`medallion ${t.urgent ? "medallion-warn" : "medallion-brand"} !h-7 !w-7 !rounded-[9px]`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <span className="stat-value">{t.value}</span>
            </div>
          );
        })}
      </div>

      {/* AI: write the review ask */}
      <AskGenerator aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)} />

      <div className="reveal flex flex-wrap gap-2" style={{ animationDelay: "120ms" }}>
        <a
          href="/marketing/reviews"
          className={"chip " + (!status ? "border-brand-strong bg-brand text-on-brand" : "chip-outline hover:bg-hover")}
        >
          All
        </a>
        {STATUSES.map((s) => {
          const active = status === s;
          return (
            <a
              key={s}
              href={`/marketing/reviews?status=${s}`}
              className={"chip " + (active ? "border-brand-strong bg-brand text-on-brand" : "chip-outline hover:bg-hover")}
            >
              {STATUS_LABEL[s]}
              <span className={active ? "text-on-brand/70" : "text-ink-4"}>{counts[s]}</span>
            </a>
          );
        })}
      </div>

      <div className="panel reveal" style={{ animationDelay: "180ms" }}>
        <ReviewTable rows={(rows ?? []) as ReviewRow[]} />
      </div>
    </div>
  );
}
