import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MarketingOverview } from "./marketing-overview";

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
      <div className="space-y-5">
        <div>
          <p className="eyebrow mb-2">Marketing</p>
          <h1 className="page-title">Growth, referrals &amp; reputation</h1>
        </div>
        <div className="panel">
          <div className="empty-state">
            <span className="medallion medallion-warn">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <p className="empty-state-title">Marketing tables aren&rsquo;t set up yet</p>
            <p className="empty-state-body">
              Apply <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[0.7rem] text-ink-2">supabase/migrations/20260610200000_marketing_core.sql</code>, then reload this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const campaigns = campaignsRes.data ?? [];
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  return (
    <MarketingOverview
      campaigns={campaigns}
      counts={{
        activeCampaigns,
        calls: queuedRes.count ?? 0,
        openReferrals: openReferralsRes.count ?? 0,
        rewardsDue: rewardsDueRes.count ?? 0,
        reviews: reviewsToAskRes.count ?? 0,
      }}
    />
  );
}
