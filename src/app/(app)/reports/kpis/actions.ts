"use server";

import { createClient } from "@/lib/supabase/server";

export type SaveKpisState = { error: string | null; success: boolean };

const KPI_DEFINITIONS = [
  { key: "capacity_utilization_pct",  label: "Capacity Utilization",        unit: "%" },
  { key: "customer_satisfaction",     label: "Customer Satisfaction Score",  unit: "score (1–10)" },
  { key: "quote_to_install_days",     label: "Quote → Install Lead Time",    unit: "days" },
  { key: "quality_score_pct",         label: "Quality Pass Rate",            unit: "%" },
  { key: "on_time_delivery_pct",      label: "On-Time Delivery",             unit: "%" },
  { key: "crew_utilization_pct",      label: "Crew Utilization",             unit: "%" },
  { key: "gross_margin_pct",          label: "Gross Margin",                 unit: "%" },
] as const;

export async function saveKpis(
  prevState: SaveKpisState,
  formData: FormData
): Promise<SaveKpisState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", success: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "office")) {
    return { error: "You do not have permission to edit KPIs.", success: false };
  }

  const monthRaw = formData.get("month") as string;
  const yearRaw = formData.get("year") as string;
  const month = parseInt(monthRaw);
  const year = parseInt(yearRaw);

  if (!month || !year || month < 1 || month > 12 || year < 2020) {
    return { error: "Invalid period.", success: false };
  }

  const rows = KPI_DEFINITIONS.map(({ key, label, unit }) => {
    const targetRaw = formData.get(`target_${key}`) as string;
    const actualRaw = formData.get(`actual_${key}`) as string;
    const notesRaw = (formData.get(`notes_${key}`) as string) || null;

    const target = targetRaw !== "" && targetRaw !== null ? parseFloat(targetRaw) : null;
    const actual = actualRaw !== "" && actualRaw !== null ? parseFloat(actualRaw) : null;

    return {
      period_month: month,
      period_year: year,
      kpi_key: key,
      kpi_label: label,
      actual_value: isNaN(actual as number) ? null : actual,
      target_value: isNaN(target as number) ? null : target,
      unit,
      notes: notesRaw?.trim() || null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("kpi_entries")
    .upsert(rows, {
      onConflict: "kpi_key,period_month,period_year",
    });

  if (error) {
    return { error: `Failed to save KPIs: ${error.message}`, success: false };
  }

  return { error: null, success: true };
}
