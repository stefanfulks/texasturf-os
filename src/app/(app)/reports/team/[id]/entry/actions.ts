"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SaveKpisState = { error: string | null; success: boolean; savedCount?: number };

export async function saveTeamKpis(
  _prev: SaveKpisState,
  formData: FormData
): Promise<SaveKpisState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "office")) {
    return { error: "You do not have permission to enter KPIs.", success: false };
  }

  const memberId = formData.get("member_id") as string;
  const monthStr = formData.get("period_month") as string;
  const yearStr = formData.get("period_year") as string;
  const kpiKeysRaw = formData.get("kpi_keys") as string;

  if (!memberId || !monthStr || !yearStr || !kpiKeysRaw) {
    return { error: "Missing required fields.", success: false };
  }

  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  if (!month || !year || month < 1 || month > 12 || year < 2020) {
    return { error: "Invalid period.", success: false };
  }

  const kpiKeys = kpiKeysRaw.split(",").filter(Boolean);

  const rows = kpiKeys
    .map((key) => {
      const actualRaw = formData.get(`actual_${key}`) as string | null;
      const notes = (formData.get(`notes_${key}`) as string | null) ?? null;

      if (actualRaw === null || actualRaw === "") return null;
      const actual = parseFloat(actualRaw);
      if (isNaN(actual)) return null;

      return {
        team_member_id: memberId,
        kpi_key: key,
        period_month: month,
        period_year: year,
        actual_value: actual,
        notes: notes?.trim() || null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return { error: "No valid KPI values were provided.", success: false };
  }

  const { error } = await supabase
    .from("team_kpi_entries")
    .upsert(rows, {
      onConflict: "team_member_id,kpi_key,period_month,period_year",
    });

  if (error) {
    console.error("saveTeamKpis error:", error);
    return { error: `Failed to save KPIs: ${error.message}`, success: false };
  }

  return { error: null, success: true, savedCount: rows.length };
}
