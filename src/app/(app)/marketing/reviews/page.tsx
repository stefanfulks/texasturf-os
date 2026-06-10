import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { ReviewTable, BuildReviewListButton } from "./review-table";

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
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Reviews table isn&rsquo;t in the database yet. Apply the marketing_reviews migration, then reload.
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

  const tiles = [
    { label: "To ask", value: counts.pending, accent: counts.pending > 0 ? "text-amber-600" : "text-zinc-900" },
    { label: "Requested", value: counts.requested, accent: "text-zinc-900" },
    { label: "Received this month", value: receivedThisMonth, accent: "text-emerald-600" },
    { label: "Response rate", value: `${responseRate}%`, accent: "text-zinc-900" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Ask completed-job clients for a review — the local-SEO lever. Build the list, send via Jobber/text, track where it lands.
          </p>
        </div>
        <BuildReviewListButton />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">{t.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${t.accent}`}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <a href="/marketing/reviews" className={`text-xs px-2.5 py-1 rounded-full border ${!status ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
          All
        </a>
        {STATUSES.map((s) => (
          <a key={s} href={`/marketing/reviews?status=${s}`} className={`text-xs px-2.5 py-1 rounded-full border ${status === s ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
            {STATUS_LABEL[s]} {counts[s]}
          </a>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <ReviewTable rows={(rows ?? []) as ReviewRow[]} />
      </div>
    </div>
  );
}
