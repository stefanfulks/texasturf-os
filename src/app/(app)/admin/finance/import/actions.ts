"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { logFinChange } from "@/lib/finance/audit";
import { parseArCsv, parseApCsv } from "@/lib/finance/io";

export async function importAr(text: string): Promise<{ inserted: number }> {
  await requireAdmin();
  const rows = parseArCsv(text);
  const supabase = await createClient();
  const { error } = await supabase.from("fin_ar_invoice").insert(rows.map((r) => ({
    customer: r.customer, invoice_num: r.invoiceNum, invoice_date: r.invoiceDate || null,
    open_balance: r.openBalance, expected_receipt_date: r.expectedReceiptDate || null, result: "planned",
  })));
  if (error) throw new Error(error.message);
  await logFinChange({ table: "fin_ar_invoice", field: "import", newValue: `${rows.length} rows` });
  revalidatePath("/admin/finance/cash-flow");
  return { inserted: rows.length };
}

export async function importAp(text: string): Promise<{ inserted: number }> {
  await requireAdmin();
  const rows = parseApCsv(text);
  const supabase = await createClient();
  const { error } = await supabase.from("fin_ap_bill").insert(rows.map((r) => ({
    vendor: r.vendor, bill_num: r.billNum, invoice_date: r.invoiceDate || null,
    open_balance: r.openBalance, expected_pay_date: r.expectedPayDate || null, payment_type: r.paymentType,
  })));
  if (error) throw new Error(error.message);
  await logFinChange({ table: "fin_ap_bill", field: "import", newValue: `${rows.length} rows` });
  revalidatePath("/admin/finance/cash-flow");
  return { inserted: rows.length };
}
