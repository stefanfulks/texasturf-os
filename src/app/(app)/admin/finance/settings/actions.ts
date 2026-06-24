"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { logFinChange } from "@/lib/finance/audit";

type FinSettingsTable =
  | "fin_company_settings" | "fin_account" | "fin_business_unit"
  | "fin_product" | "fin_cost_rate" | "fin_labor_role" | "fin_burden_rate"
  | "fin_qb_account_map";

export async function upsertFinRow(table: FinSettingsTable, row: Record<string, unknown>) {
  await requireAdmin();
  const supabase = await createClient();
  // Dynamic table name: supabase-js can't infer the row type across the union, cast is safe.
  const { error } = await supabase.from(table).upsert(row as never);
  if (error) throw new Error(error.message);
  await logFinChange({ table, rowId: String(row.id ?? row.fiscal_year ?? ""), field: "upsert", newValue: JSON.stringify(row) });
  revalidatePath("/admin/finance/settings");
}

export async function deleteFinRow(table: FinSettingsTable, id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id" as never, id as never);
  if (error) throw new Error(error.message);
  await logFinChange({ table, rowId: id, field: "delete" });
  revalidatePath("/admin/finance/settings");
}
