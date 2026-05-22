"use server";

import { createClient } from "@/lib/supabase/server";

export type SaveBudgetsState = { error: string | null; success: boolean };

const CATEGORIES = ["subcontractors", "materials", "labor", "overhead", "equipment", "other"] as const;

export async function saveBudgets(
  prevState: SaveBudgetsState,
  formData: FormData
): Promise<SaveBudgetsState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", success: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "office")) {
    return { error: "You do not have permission to edit budgets.", success: false };
  }

  const monthRaw = formData.get("month") as string;
  const yearRaw = formData.get("year") as string;
  const month = parseInt(monthRaw);
  const year = parseInt(yearRaw);

  if (!month || !year || month < 1 || month > 12 || year < 2020) {
    return { error: "Invalid period.", success: false };
  }

  const rows = CATEGORIES.map((cat) => {
    const amountRaw = formData.get(`amount_${cat}`) as string;
    const notes = (formData.get(`notes_${cat}`) as string) || null;
    const amount = parseFloat(amountRaw) || 0;
    return {
      period_month: month,
      period_year: year,
      category: cat,
      budgeted_amount: amount,
      notes: notes?.trim() || null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("budgets")
    .upsert(rows, {
      onConflict: "period_month,period_year,category",
    });

  if (error) {
    return { error: `Failed to save budgets: ${error.message}`, success: false };
  }

  return { error: null, success: true };
}
