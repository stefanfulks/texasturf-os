import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Megaphone, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CampaignCreateForm } from "./campaign-create-form";
import { StatusChip, typeMeta, shortDate } from "../marketing-overview";

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
      <div className="space-y-5">
        <div>
          <p className="eyebrow mb-2">Marketing</p>
          <h1 className="page-title">Campaigns</h1>
        </div>
        <div className="panel">
          <div className="empty-state">
            <span className="medallion medallion-warn">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <p className="empty-state-title">Marketing tables aren&rsquo;t set up yet</p>
            <p className="empty-state-body">Apply the marketing migrations, then reload this page.</p>
          </div>
        </div>
      </div>
    );
  }

  const list = campaigns ?? [];

  return (
    <div className="space-y-6">
      <header className="reveal flex flex-col gap-1">
        <p className="eyebrow mb-1">Marketing</p>
        <h1 className="page-title">Campaigns</h1>
        <p className="page-sub">
          Briefs plus the exact copy to paste into Jobber. Referral &amp; spotlight
          campaigns live here.
        </p>
      </header>

      <details className="panel group reveal" style={{ animationDelay: "60ms" }}>
        <summary className="flex cursor-pointer select-none list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-hover">
          <span className="medallion medallion-brand">
            <Plus className="h-[18px] w-[18px]" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">New campaign</span>
            <span className="block text-xs text-ink-3">Name it, pick a type, and we&rsquo;ll scaffold the brief.</span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-ink-4 transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t border-line p-5">
          <CampaignCreateForm aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)} />
        </div>
      </details>

      <section className="panel reveal" style={{ animationDelay: "120ms" }}>
        <div className="panel-head">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">All campaigns</span>
            <span className="chip chip-neutral">{list.length}</span>
          </div>
        </div>
        {list.length === 0 ? (
          <div className="empty-state">
            <span className="medallion medallion-brand">
              <Megaphone className="h-5 w-5" />
            </span>
            <p className="empty-state-title">No campaigns yet</p>
            <p className="empty-state-body">
              Use the form above to launch your first campaign — it scaffolds the brief
              and the Jobber copy for you.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((c) => {
              const meta = typeMeta(c.type);
              const Icon = meta.icon;
              const start = shortDate(c.starts_on);
              return (
                <li key={c.id}>
                  <Link
                    href={`/marketing/campaigns/${c.id}`}
                    className="row-link flex items-center gap-3.5 px-4 py-3.5 sm:px-5"
                  >
                    <span className={`medallion ${meta.medallion}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-3">
                        {meta.label}
                        {c.service_line ? ` · ${c.service_line.replace(/_/g, " ")}` : ""}
                        {start ? ` · starts ${start}` : ""}
                      </p>
                    </div>
                    <StatusChip status={c.status} />
                    <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-ink-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
