import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Download, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { RosterTable, BuildRosterButton } from "./roster-table";
import { LedgerTable, AddReferralForm } from "./ledger-table";
import { ScriptsGenerator } from "./scripts-generator";

export type OutreachRow = Pick<
  Database["public"]["Tables"]["referral_outreach"]["Row"],
  | "id" | "client_name" | "client_phone" | "client_email" | "last_job_note"
  | "segment" | "call_status" | "attempts" | "last_called_at" | "notes"
>;
export type ReferralRow = Database["public"]["Tables"]["referrals"]["Row"];

const CALL_STATUSES = [
  "queued", "no_answer", "declined", "referred", "do_not_call", "invalid_number",
] as const;

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  no_answer: "No answer",
  declined: "Declined",
  referred: "Referred",
  do_not_call: "Do not call",
  invalid_number: "Bad number",
};

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Active referral campaign (seeded by the marketing_core migration).
  const { data: campaign, error: campaignErr } = await supabase
    .from("campaigns")
    .select("id, name, slug, status, brief_md, jobber_copy, starts_on")
    .eq("type", "referral")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (campaignErr || !campaign) {
    return (
      <div className="space-y-5">
        <div>
          <p className="eyebrow mb-2">Marketing</p>
          <h1 className="page-title">Referral Program</h1>
        </div>
        <div className="panel">
          <div className="empty-state">
            <span className="medallion medallion-warn">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <p className="empty-state-title">
              {campaignErr ? "Marketing tables aren’t set up yet" : "No referral campaign found"}
            </p>
            <p className="empty-state-body">
              {campaignErr
                ? "Apply supabase/migrations/20260610200000_marketing_core.sql, then reload."
                : "The marketing_core migration seeds “Referral Thank-You Blitz 2026” — apply it, then reload."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [profileRes, ...statusCounts] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    ...CALL_STATUSES.map((s) =>
      supabase
        .from("referral_outreach")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("call_status", s),
    ),
  ]);
  const isAdmin = profileRes.data?.role === "admin";
  const counts = Object.fromEntries(
    CALL_STATUSES.map((s, i) => [s, statusCounts[i]?.count ?? 0]),
  ) as Record<(typeof CALL_STATUSES)[number], number>;
  const rosterTotal = CALL_STATUSES.reduce((sum, s) => sum + counts[s], 0);

  let rosterQuery = supabase
    .from("referral_outreach")
    .select("id, client_name, client_phone, client_email, last_job_note, segment, call_status, attempts, last_called_at, notes")
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (status && (CALL_STATUSES as readonly string[]).includes(status)) {
    rosterQuery = rosterQuery.eq("call_status", status as (typeof CALL_STATUSES)[number]);
  }
  if (q?.trim()) rosterQuery = rosterQuery.ilike("client_name", `%${q.trim()}%`);

  const [{ data: roster }, { data: referrals }] = await Promise.all([
    rosterQuery,
    supabase
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const rewardsDue = (referrals ?? []).filter((r) => r.reward_status === "due").length;

  return (
    <div className="space-y-6">
      <header className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Marketing · Referral program</p>
          <h1 className="page-title">{campaign.name}</h1>
          <p className="page-sub">
            $250 Visa gift card or a year of the TexasTurf Care Plan — earned when the
            referred job is completed and paid. Referred friends get $100 off.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BuildRosterButton campaignId={campaign.id} />
          <a
            href={`/marketing/referrals/export?campaign=${campaign.id}`}
            className="btn btn-line"
          >
            <Download className="h-4 w-4" />
            Export Reevo CSV
          </a>
        </div>
      </header>

      {/* Ask scripts — what to actually say */}
      <ScriptsGenerator aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)} />

      {/* Funnel chips */}
      <div className="reveal flex flex-wrap items-center gap-2" style={{ animationDelay: "60ms" }}>
        <Link
          href="/marketing/referrals"
          className={"chip " + (!status ? "border-brand-strong bg-brand text-on-brand" : "chip-outline hover:bg-hover")}
        >
          All <span className={!status ? "text-on-brand/70" : "text-ink-4"}>{rosterTotal}</span>
        </Link>
        {CALL_STATUSES.map((s) => {
          const active = status === s;
          return (
            <Link
              key={s}
              href={`/marketing/referrals?status=${s}`}
              className={"chip " + (active ? "border-brand-strong bg-brand text-on-brand" : "chip-outline hover:bg-hover")}
            >
              {STATUS_LABEL[s]} <span className={active ? "text-on-brand/70" : "text-ink-4"}>{counts[s]}</span>
            </Link>
          );
        })}
        <span className="ml-auto" />
        <span className={"chip " + (rewardsDue > 0 ? "chip-danger" : "chip-neutral")}>
          Rewards due {rewardsDue}
        </span>
      </div>

      {/* Search */}
      <form method="get" className="reveal flex gap-2" style={{ animationDelay: "120ms" }}>
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search clients…"
            className="field-input !pl-9"
          />
        </div>
        <button type="submit" className="btn btn-line">Search</button>
      </form>

      {/* Call roster */}
      <section className="panel reveal" style={{ animationDelay: "180ms" }}>
        <div className="panel-head">
          <span className="text-sm font-semibold text-ink">Call roster</span>
          <span className="text-xs text-ink-3">
            showing {(roster ?? []).length} of {status ? counts[status as (typeof CALL_STATUSES)[number]] : rosterTotal}
          </span>
        </div>
        <RosterTable rows={(roster ?? []) as OutreachRow[]} campaignId={campaign.id} />
      </section>

      {/* Ledger */}
      <section className="panel reveal" style={{ animationDelay: "240ms" }}>
        <div className="panel-head">
          <span className="text-sm font-semibold text-ink">Referral ledger</span>
          <span className="text-xs text-ink-3">{(referrals ?? []).length} referrals</span>
        </div>
        <LedgerTable rows={(referrals ?? []) as ReferralRow[]} isAdmin={isAdmin} />
      </section>

      {/* Manual add */}
      <details className="panel group reveal" style={{ animationDelay: "300ms" }}>
        <summary className="flex cursor-pointer select-none list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-hover">
          <span className="medallion medallion-brand">
            <Plus className="h-[18px] w-[18px]" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Add a referral manually</span>
            <span className="block text-xs text-ink-3">Walk-in, Jobber link, or word of mouth.</span>
          </span>
        </summary>
        <div className="border-t border-line p-5">
          <AddReferralForm campaignId={campaign.id} />
        </div>
      </details>
    </div>
  );
}
