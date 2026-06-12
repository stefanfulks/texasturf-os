import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeamMemberArchiveButton } from "./archive-button";
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

function computeKpiScore(
  def: TeamKpiDefinition,
  entry: TeamKpiEntry | undefined
): number | null {
  if (!entry || entry.actual_value === null) return null;
  const actual = Number(entry.actual_value);
  const target = Number(def.target_value);
  if (target === 0) return null;
  return def.lower_is_better
    ? Math.min(100, (target / actual) * 100)
    : Math.min(100, (actual / target) * 100);
}

function computeOverallScore(
  definitions: TeamKpiDefinition[],
  entries: TeamKpiEntry[]
): number | null {
  const entryMap = new Map<string, TeamKpiEntry>();
  for (const e of entries) entryMap.set(e.kpi_key, e);

  const scores: number[] = [];
  for (const def of definitions) {
    const s = computeKpiScore(def, entryMap.get(def.kpi_key));
    if (s !== null) scores.push(s);
  }

  if (scores.length === 0) return null;
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

function scoreColorClass(score: number | null): {
  text: string;
  bg: string;
  dot: string;
  label: string;
} {
  if (score === null)
    return { text: "text-ink-4", bg: "bg-hover", dot: "bg-line-strong", label: "No data" };
  if (score >= 90)
    return { text: "text-brand", bg: "bg-brand-tint", dot: "bg-brand", label: "On Track" };
  if (score >= 70)
    return { text: "text-warn", bg: "bg-warn-tint", dot: "bg-warn", label: "Needs Attention" };
  return { text: "text-danger", bg: "bg-danger-tint", dot: "bg-danger", label: "At Risk" };
}

function formatValue(value: number | null, unit: string | null): string {
  if (value === null) return "—";
  const n = Number(value);
  if (unit === "$") {
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
  }
  if (Number.isInteger(n)) return `${n.toLocaleString("en-US")}${unit ? ` ${unit}` : ""}`;
  return `${n.toFixed(2)}${unit ? ` ${unit}` : ""}`;
}

// Build last-6-months lookback periods
function last6Periods(
  month: number,
  year: number
): Array<{ month: number; year: number; label: string }> {
  const periods = [];
  let m = month;
  let y = year;
  for (let i = 0; i < 6; i++) {
    periods.unshift({
      month: m,
      year: y,
      label: new Date(y, m - 1, 1).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
    });
    const p = prevPeriod(m, y);
    m = p.month;
    y = p.year;
  }
  return periods;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function TeamMemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { id } = await params;
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
  const isOfficeOrAdmin = ["admin", "office"].includes(profile.role);

  // Fetch member
  const { data: memberData } = await supabase
    .from("team_members")
    .select("*")
    .eq("id", id)
    .single();

  if (!memberData) notFound();
  const member = memberData as unknown as TeamMember;

  // Fetch KPI definitions for this member
  const { data: defsData } = await supabase
    .from("team_kpi_definitions")
    .select("*")
    .eq("team_member_id", id)
    .order("kpi_label");

  const definitions = (defsData ?? []) as unknown as TeamKpiDefinition[];

  // Fetch entries for current period
  const { data: currentEntriesData } = await supabase
    .from("team_kpi_entries")
    .select("*")
    .eq("team_member_id", id)
    .eq("period_month", month)
    .eq("period_year", year);

  const currentEntries = (currentEntriesData ?? []) as unknown as TeamKpiEntry[];

  // Fetch last 6 months of entries for trend
  const periods = last6Periods(month, year);
  const earliest = periods[0];

  const { data: trendEntriesData } = await supabase
    .from("team_kpi_entries")
    .select("*")
    .eq("team_member_id", id)
    .gte("period_year", earliest.year)
    .order("period_year")
    .order("period_month");

  const trendEntries = (trendEntriesData ?? []) as unknown as TeamKpiEntry[];

  // Build trend map: kpi_key -> { "May '26": value, ... }
  const trendMap = new Map<string, Map<string, number | null>>();
  for (const def of definitions) {
    trendMap.set(def.kpi_key, new Map());
  }
  for (const e of trendEntries) {
    const label = new Date(e.period_year, e.period_month - 1, 1).toLocaleDateString(
      "en-US",
      { month: "short", year: "2-digit" }
    );
    const kpiMap = trendMap.get(e.kpi_key);
    if (kpiMap) kpiMap.set(label, e.actual_value);
  }

  // Current entry map
  const currentEntryMap = new Map<string, TeamKpiEntry>();
  for (const e of currentEntries) currentEntryMap.set(e.kpi_key, e);

  const overallScore = computeOverallScore(definitions, currentEntries);
  const overallColors = scoreColorClass(overallScore);

  // Check if any KPI has at least one trend entry
  const hasTrendData = definitions.some((def) => {
    const m = trendMap.get(def.kpi_key);
    return m && m.size > 0;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Back + Header */}
      <div>
        <Link
          href={`/reports/team?month=${month}&year=${year}`}
          className="text-sm text-ink-3 hover:text-ink transition-colors font-medium"
        >
          &larr; Team Performance
        </Link>
        <div className="mt-3 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{member.full_name}</h1>
            <p className="text-sm text-ink-3 mt-0.5">{member.role_title}</p>
            {member.department && (
              <p className="text-xs text-ink-4 mt-0.5">{member.department}</p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {!member.active && (
              <span className="rounded-full bg-sunken px-3 py-1 text-xs font-medium text-ink-3">
                Inactive
              </span>
            )}
            <Link
              href={`/reports/team/${member.id}/entry?month=${month}&year=${year}`}
              className="bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-brand-strong transition-colors"
            >
              Enter / Edit KPIs →
            </Link>
            {isOfficeOrAdmin && (
              <TeamMemberArchiveButton memberId={member.id} archived={!member.active} />
            )}
          </div>
        </div>
      </div>

      {/* Overall Score Card */}
      <div className={`rounded-xl border border-line p-6 ${overallColors.bg}`}>
        <p className="text-sm font-semibold text-ink-3 uppercase tracking-wide mb-2">
          Overall Performance — {monthName(month, year)}
        </p>
        <div className="flex items-end gap-4">
          <span className={`text-5xl font-bold ${overallColors.text}`}>
            {overallScore !== null ? `${Math.round(overallScore)}%` : "—"}
          </span>
          <div className="mb-1">
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-semibold ${overallColors.text}`}
            >
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${overallColors.dot}`}
              />
              {overallColors.label}
            </span>
            <p className="text-xs text-ink-3 mt-0.5">
              {currentEntries.filter((e) => e.actual_value !== null).length} of{" "}
              {definitions.length} KPIs entered
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 h-2 rounded-full bg-line overflow-hidden max-w-sm">
          <div
            className={`h-full rounded-full transition-all ${overallColors.dot}`}
            style={{ width: `${overallScore ?? 0}%` }}
          />
        </div>
      </div>

      {/* KPI Table */}
      <section>
        <p className="text-sm font-semibold text-ink-3 uppercase tracking-wide mb-3">
          KPI Breakdown — {monthName(month, year)}
        </p>
        <div className="rounded-xl border border-line bg-white overflow-hidden">
          {definitions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-ink-4">No KPI definitions found for this member.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-hover">
                  <th className="text-left px-4 py-3 font-semibold text-ink-2">KPI</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink-2">Target</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink-2">Actual</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink-2">Score</th>
                  <th className="text-center px-4 py-3 font-semibold text-ink-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {definitions.map((def) => {
                  const entry = currentEntryMap.get(def.kpi_key);
                  const score = computeKpiScore(def, entry);
                  const colors = scoreColorClass(score);
                  return (
                    <tr key={def.id} className="border-b border-line hover:bg-hover/50">
                      <td className="px-4 py-3 text-ink font-medium">
                        {def.kpi_label}
                        {def.lower_is_better && (
                          <span className="ml-1.5 text-xs text-ink-4">(lower is better)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-2">
                        {formatValue(def.target_value, def.unit)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-ink">
                        {entry?.actual_value !== undefined
                          ? formatValue(entry.actual_value, def.unit)
                          : "—"}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${colors.text}`}>
                        {score !== null ? `${Math.round(score)}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}
                          >
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${colors.dot}`}
                            />
                            {colors.label}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 6-Month Trend */}
      {hasTrendData && (
        <section>
          <p className="text-sm font-semibold text-ink-3 uppercase tracking-wide mb-3">
            6-Month Trend
          </p>
          <div className="rounded-xl border border-line bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-hover">
                  <th className="text-left px-4 py-3 font-semibold text-ink-2 min-w-[180px]">
                    KPI
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-ink-2">Target</th>
                  {periods.map((p) => (
                    <th
                      key={`${p.year}-${p.month}`}
                      className="text-right px-4 py-3 font-semibold text-ink-2 min-w-[80px]"
                    >
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {definitions.map((def) => {
                  const kpiTrend = trendMap.get(def.kpi_key);
                  if (!kpiTrend || kpiTrend.size === 0) return null;
                  return (
                    <tr key={def.id} className="border-b border-line hover:bg-hover/50">
                      <td className="px-4 py-3 text-ink font-medium">{def.kpi_label}</td>
                      <td className="px-4 py-3 text-right text-ink-3">
                        {formatValue(def.target_value, def.unit)}
                      </td>
                      {periods.map((p) => {
                        const val = kpiTrend.get(p.label) ?? null;
                        const isCurrent = p.month === month && p.year === year;
                        const entryForPeriod = val !== null ? { actual_value: val } as TeamKpiEntry : undefined;
                        const s = computeKpiScore(def, entryForPeriod);
                        const c = scoreColorClass(s);
                        return (
                          <td
                            key={`${p.year}-${p.month}`}
                            className={`px-4 py-3 text-right font-medium ${
                              isCurrent ? "bg-hover" : ""
                            } ${c.text}`}
                          >
                            {formatValue(val, def.unit)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
