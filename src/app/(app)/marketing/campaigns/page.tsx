import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CampaignCreateForm } from "./campaign-create-form";

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

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, slug, name, type, status, service_line, starts_on")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Marketing tables aren&rsquo;t in the database yet. Apply the marketing migrations, then reload.
        </div>
      </div>
    );
  }

  const list = campaigns ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Briefs + the exact copy to paste into Jobber. Referral &amp; spotlight campaigns live here.
        </p>
      </div>

      <details className="rounded-xl border border-zinc-200 bg-white p-5">
        <summary className="text-sm font-semibold cursor-pointer select-none">New campaign</summary>
        <div className="mt-4"><CampaignCreateForm /></div>
      </details>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-600">All campaigns</span>
          <span className="text-xs text-zinc-400">{list.length}</span>
        </div>
        {list.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">No campaigns yet.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {list.map((c) => (
              <Link key={c.id} href={`/marketing/campaigns/${c.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{c.name}</p>
                  <p className="text-xs text-zinc-400">
                    {TYPE_LABEL[c.type] ?? c.type}
                    {c.service_line ? ` · ${c.service_line.replace(/_/g, " ")}` : ""}
                    {c.starts_on ? ` · starts ${c.starts_on}` : ""}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[c.status] ?? STATUS_BADGE.draft}`}>{c.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
