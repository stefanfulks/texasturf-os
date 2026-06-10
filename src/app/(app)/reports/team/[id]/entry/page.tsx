import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { TeamMember, TeamKpiDefinition, TeamKpiEntry } from "@/lib/db-helpers.types";
import { TeamKpiEntryForm } from "./kpi-entry-form";

export default async function TeamKpiEntryPage({
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

  // Fetch member
  const { data: memberData } = await supabase
    .from("team_members")
    .select("*")
    .eq("id", id)
    .single();

  if (!memberData) notFound();
  const member = memberData as unknown as TeamMember;

  // Fetch KPI definitions
  const { data: defsData } = await supabase
    .from("team_kpi_definitions")
    .select("*")
    .eq("team_member_id", id)
    .order("kpi_label");

  const definitions = (defsData ?? []) as unknown as TeamKpiDefinition[];

  // Fetch existing entries for this period
  const { data: entriesData } = await supabase
    .from("team_kpi_entries")
    .select("*")
    .eq("team_member_id", id)
    .eq("period_month", month)
    .eq("period_year", year);

  const entries = (entriesData ?? []) as unknown as TeamKpiEntry[];

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link
        href={`/reports/team/${id}?month=${month}&year=${year}`}
        className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium"
      >
        &larr; {member.full_name}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Enter KPIs</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {member.full_name} &mdash; {member.role_title} &mdash; {monthLabel}
        </p>
      </div>

      {definitions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-zinc-400">
            No KPI definitions found for this team member.
          </p>
        </div>
      ) : (
        <TeamKpiEntryForm
          member={member}
          definitions={definitions}
          entries={entries}
          month={month}
          year={year}
        />
      )}
    </div>
  );
}
