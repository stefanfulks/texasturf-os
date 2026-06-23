import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { toMatrix } from "@/lib/finance/io";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await requireAdmin();
  const dataset = new URL(req.url).searchParams.get("dataset") ?? "budget";
  const supabase = await createClient();

  let headers: string[] = [];
  let rows: Record<string, unknown>[] = [];
  if (dataset === "budget") {
    const { data } = await supabase.from("fin_account_value").select("account_id, period_id, budget_amount, actual_amount");
    headers = ["account_id", "period_id", "budget_amount", "actual_amount"];
    rows = data ?? [];
  } else if (dataset === "ar") {
    const { data } = await supabase.from("fin_ar_invoice").select("customer, invoice_num, open_balance, expected_receipt_date");
    headers = ["customer", "invoice_num", "open_balance", "expected_receipt_date"];
    rows = data ?? [];
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(dataset);
  toMatrix(headers, rows).forEach((r) => ws.addRow(r as ExcelJS.CellValue[]));
  const buffer = await wb.xlsx.writeBuffer();

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="finance-${dataset}.xlsx"`,
    },
  });
}
