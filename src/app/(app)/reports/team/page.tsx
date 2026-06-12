import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TeamMember, TeamKpiDefinition, TeamKpiEntry } from "@/lib/db-helpers.types";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function monthName(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function prevPeriod(month: number, year: number) {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}

function nextPeriod(month: number, year: number) {
  if (month === 12) return { month: 1, year: year + 1 };
  return { month: month + 1, year };
}

function computeScore(
  definitions: TeamKpiDefinition[],
  entries: TeamKpiEntry[]
): number | null {
  const entryMap = new Map<string, TeamKpiEntry>();
  for (const e of entries) entryMap.set(e.kpi_key, e);

  const scores: number[] = [];
  for (const def of definitions) {
    const entry = entryMap.get(def.kpi_key);
    if (!entry || entry.actual_value === null) continue;
    const actual = Number(entry.actual_value);
    const target = Number(def.target_value);
    if (target === 0) continue;
    const score = def.lower_is_better
      ? Math.min(100, (target / actual) * 100)
      : Math.min(100, (actual / target) * 100);
    scores.push(score);
  }

  if (scores.length === 0) return null;
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

function scoreColor(score: number | null): {
  text: string;
  bg: string;
  bar: string;
  label: string;
} {
  if (score === null)
    return {
      text: "text-ink-4",
      bg: "bg-hover",
      bar: "bg-line-strong",
      label: "No data",
    };
  if (score >= 90)
    return {
      text: "text-brand",
      bg: "bg-brand-tint",
      bar: "bg-brand",
      label: "On Track",
    };
  if (score >= 70)
    return {
      text: "text-warn",
      bg: "bg-warn-tint",
      bar: "bg-warn",
      label: "Needs Attention",
    };
  return {
    text: "text-danger",
    bg: "bg-danger-tint",
    bar: "bg-danger",
    label: "At Risk",
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function TeamPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { month: monthParam, year: yearParam } = await searchParams;

  const now = new Date();
  const month = Math.min(
    12,
    Math.max(1, parseInt(monthParam ?? "") || now.getMonth() + 1)
  );
  const year = Math.max(2020, parseInt(yearParam ?? "") || now.getFullYear());

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "field") {
    redirect("/");
  }

  // ── Fetch data ──────────────────────────────────────────────
  const [membersResult, definitionsResult, entriesResult] = await Promise.all([
    supabase
      .from("team_members")
      .select("*")
      .eq("active", true)
      .order("full_name"),
    supabase.from("team_kpi_definitions").select("*"),
    supabase
      .from("team_kpi_entries")
      .select("*")
      .eq("period_month", month)
      .eq("period_year", year),
  ]);

  const members = (membersResult.data ?? []) as unknown as TeamMember[];
  const definitions = (definitionsResult.data ?? []) as unknown as TeamKpiDefinition[];
  const entries = (entriesResult.data ?? []) as unknown as TeamKpiEntry[];

  // Group definitions and entries by member
  const defsByMember = new Map<string, TeamKpiDefinition[]>();
  for (const d of definitions) {
    const arr = defsByMember.get(d.team_member_id) ?? [];
    arr.push(d);
    defsByMember.set(d.team_member_id, arr);
  }

  const entriesByMember = new Map<string, TeamKpiEntry[]>();
  for (const e of entries) {
    const arr = entriesByMember.get(e.team_member_id) ?? [];
    arr.push(e);
    entriesByMember.set(e.team_member_id, arr);
  }

  const prev = prevPeriod(month, year);
  const next = nextPeriod(month, year);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Team Performance</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            Individual KPI tracking by team member
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/reports/team?month=${prev.month}&year=${prev.year}`}
            className="px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-hover text-ink-2 font-medium transition-colors"
          >
            &larr; Prev
          </Link>
          <span className="font-semibold text-ink min-w-[110px] text-center">
            {monthName(month, year)}
          </span>
          <Link
            href={`/reports/team?month=${next.month}&year=${next.year}`}
            className="px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-hover text-ink-2 font-medium transition-colors"
          >
            Next &rarr;
          </Link>
        </div>
      </div>

      {/* Member Grid */}
      {members.length === 0 ? (
        <div className="rounded-xl border border-line bg-white p-12 text-center">
          <p className="text-sm text-ink-4">No active team members found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {members.map((member) => {
            const memberDefs = defsByMember.get(member.id) ?? [];
            const memberEntries = entriesByMember.get(member.id) ?? [];
            const score = computeScore(memberDefs, memberEntries);
            const colors = scoreColor(score);
            const enteredCount = memberEntries.filter(
              (e) => e.actual_value !== null
            ).length;

            return (
              <div
                key={member.id}
                className="rounded-xl border border-line bg-white p-5 flex flex-col gap-3"
              >
                <div>
                  <p className="font-semibold text-ink text-sm leading-tight">
                    {member.full_name}
                  </p>
                  <p className="text-xs text-ink-3 mt-0.5">{member.role_title}</p>
                </div>

                {/* Score */}
                <div className={`rounded-lg px-3 py-2 ${colors.bg}`}>
                  <div className="flex items-end justify-between">
                    <span className={`text-3xl font-bold ${colors.text}`}>
                      {score !== null ? `${Math.round(score)}%` : "—"}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}
                    >
                      {colors.label}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${colors.bar}`}
                      style={{ width: `${score ?? 0}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-ink-4">
                  {enteredCount} of {memberDefs.length} KPIs entered
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 mt-auto">
                  <Link
                    href={`/reports/team/${member.id}?month=${month}&year=${year}`}
                    className="text-center text-sm font-medium text-ink-2 hover:text-ink border border-line rounded-lg py-1.5 hover:bg-hover transition-colors"
                  >
                    View Details &rarr;
                  </Link>
                  <Link
                    href={`/reports/team/${member.id}/entry?month=${month}&year=${year}`}
                    className="text-center text-sm font-semibold bg-ink text-white rounded-xl px-4 py-2 hover:bg-ink transition-colors"
                  >
                    Enter KPIs &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
