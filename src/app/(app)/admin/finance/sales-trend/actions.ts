"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function saveMonthlyActual(businessUnitId: string, fiscalYear: number, month: number, amount: number) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("fin_sales_actual").upsert(
    { business_unit_id: businessUnitId, fiscal_year: fiscalYear, month, amount },
    { onConflict: "business_unit_id,fiscal_year,month" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/sales-trend");
}
