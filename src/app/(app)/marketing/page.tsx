import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TYPE_LABEL: Record<string, string> = {
  referral: "Referral",
  service_spotlight: "Service spotlight",
  seasonal: "Seasonal",
  event: "Event",
  other: "Other",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-500",
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  completed: "bg-zinc-50 text-zinc-400",
};

export default async function MarketingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [campaignsRes, queuedRes, openReferralsRes, rewardsDueRes, reviewsToAskRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, slug, name, type, status, starts_on, ends_on, service_line")
      .order("created_at", { ascending: false }),
    supabase
      .from("referral_outreach")
      .select("id", { count: "exact", head: true })
      .eq("call_status", "queued"),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .not("stage", "in", "(completed_paid,lost)"),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("reward_status", "due"),
    supabase
      .from("review_outreach")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  if (campaignsRes.error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Marketing tables aren&rsquo;t in the database yet. Apply
          {" "}<code className="font-mono">supabase/migrations/20260610200000_marketing_core.sql</code>, then reload.
        </div>
      </div>
    );
  }

  const campaigns = campaignsRes.data ?? [];
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  const tiles = [
    { label: "Active campaigns", value: activeCount, href: "/marketing", accent: "text-zinc-900" },
    { label: "Calls remaining", value: queuedRes.count ?? 0, href: "/marketing/referrals", accent: (queuedRes.count ?? 0) > 0 ? "text-amber-600" : "text-zinc-900" },
    { label: "Open referrals", value: openReferralsRes.count ?? 0, href: "/marketing/referrals", accent: "text-zinc-900" },
    { label: "Rewards due", value: rewardsDueRes.count ?? 0, href: "/marketing/referrals", accent: (rewardsDueRes.count ?? 0) > 0 ? "text-red-600" : "text-zinc-900" },
    { label: "Reviews to ask", value: reviewsToAskRes.count ?? 0, href: "/marketing/reviews", accent: (reviewsToAskRes.count ?? 0) > 0 ? "text-amber-600" : "text-zinc-900" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Campaigns, the referral program, and (soon) the content engine. Sends go out via Jobber; calls run in Reevo; this is the system of record.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 transition-colors">
            <p className="text-xs text-zinc-500">{t.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${t.accent}`}>{t.value}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-600">Campaigns</span>
          <span className="text-xs text-zinc-400">{campaigns.length}</span>
        </div>
        {campaigns.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">
            No campaigns yet — the migration seeds the Referral Thank-You Blitz.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={c.type === "referral" ? "/marketing/referrals" : "/marketing"}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{c.name}</p>
                  <p className="text-xs text-zinc-400">
                    {TYPE_LABEL[c.type] ?? c.type}
                    {c.service_line ? ` · ${c.service_line}` : ""}
                    {c.starts_on ? ` · starts ${c.starts_on}` : ""}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[c.status] ?? STATUS_BADGE.draft}`}>
                  {c.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-5">
          <p className="text-sm font-semibold text-zinc-400">Content engine</p>
          <p className="text-xs text-zinc-400 mt-1">
            Troy&rsquo;s video pipeline, the POV program, and the Drive/YouTube library index land here in Phase 2.
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-5">
          <p className="text-sm font-semibold text-zinc-400">Campaign detail &amp; playbook</p>
          <p className="text-xs text-zinc-400 mt-1">
            Briefs, Jobber copy blocks, channel checklists, and the marketing playbook land here in Phase 3.
          </p>
        </div>
      </div>
    </div>
  );
}
