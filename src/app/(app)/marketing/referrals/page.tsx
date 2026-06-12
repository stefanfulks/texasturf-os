import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { RosterTable, BuildRosterButton } from "./roster-table";
import { LedgerTable, AddReferralForm } from "./ledger-table";

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
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Referral Program</h1>
        <div className="rounded-xl border border-warn/30 bg-warn-tint p-6 text-sm text-warn">
          {campaignErr
            ? "Marketing tables aren't in the database yet. Apply supabase/migrations/20260610200000_marketing_core.sql, then reload."
            : "No referral campaign found. The marketing_core migration seeds “Referral Thank-You Blitz 2026” — apply it, then reload."}
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            $250 Visa gift card or 1 year of the TexasTurf Care Plan — earned when the referred job is completed and paid.
            Referred friends get $100 off.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BuildRosterButton campaignId={campaign.id} />
          <a
            href={`/marketing/referrals/export?campaign=${campaign.id}`}
            className="px-4 py-2 text-sm font-medium border border-line-strong rounded-lg hover:bg-hover"
          >
            Export Reevo CSV
          </a>
        </div>
      </div>

      {/* Funnel chips */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/marketing/referrals"
          className={`text-xs px-2.5 py-1 rounded-full border ${!status ? "bg-ink text-white border-ink" : "border-line text-ink-2 hover:bg-hover"}`}
        >
          All {rosterTotal}
        </Link>
        {CALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/marketing/referrals?status=${s}`}
            className={`text-xs px-2.5 py-1 rounded-full border ${status === s ? "bg-ink text-white border-ink" : "border-line text-ink-2 hover:bg-hover"}`}
          >
            {STATUS_LABEL[s]} {counts[s]}
          </Link>
        ))}
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${rewardsDue > 0 ? "bg-danger-tint text-danger" : "bg-sunken text-ink-3"}`}>
          Rewards due {rewardsDue}
        </span>
      </div>

      {/* Search */}
      <form method="get" className="flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search clients…"
          className="w-64 text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white"
        />
        <button type="submit" className="px-3 py-2 text-sm border border-line rounded-lg hover:bg-hover">
          Search
        </button>
      </form>

      {/* Call roster */}
      <div className="rounded-xl border border-line bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-line bg-hover flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-2">Call roster</span>
          <span className="text-xs text-ink-4">
            showing {(roster ?? []).length} of {status ? counts[status as (typeof CALL_STATUSES)[number]] : rosterTotal}
          </span>
        </div>
        <RosterTable rows={(roster ?? []) as OutreachRow[]} campaignId={campaign.id} />
      </div>

      {/* Ledger */}
      <div className="rounded-xl border border-line bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-line bg-hover flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-2">Referral ledger</span>
          <span className="text-xs text-ink-4">{(referrals ?? []).length} referrals</span>
        </div>
        <LedgerTable rows={(referrals ?? []) as ReferralRow[]} isAdmin={isAdmin} />
      </div>

      {/* Manual add */}
      <details className="rounded-xl border border-line bg-white p-6">
        <summary className="text-sm font-semibold cursor-pointer select-none">
          Add a referral manually (walk-in, Jobber link, word of mouth)
        </summary>
        <div className="mt-4">
          <AddReferralForm campaignId={campaign.id} />
        </div>
      </details>
    </div>
  );
}
