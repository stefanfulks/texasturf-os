/**
 * QuickBooks AR aging → fin_ar_invoice.
 *
 * Open invoices (Balance > 0) upsert on external_id (= QB invoice id).
 * Planning fields the finance team edits (expected_receipt_date, result) are
 * only seeded on first insert — re-syncs update the QB-owned columns and
 * leave the plan alone. QB-sourced rows that drop out of the open set are
 * closed out as paid.
 *
 * Service-role client only — never in a user-reachable path.
 */

import { qbQueryAll } from "../api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logSync } from "./log";

type QbInvoice = {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  Balance?: number;
  CustomerRef?: { value: string; name?: string };
};

export async function syncArInvoices(realmId: string): Promise<number> {
  try {
    const open = await qbQueryAll<QbInvoice>(realmId, "Invoice", "Balance > '0'");
    const sb = supabaseAdmin();

    const { data: existing, error: exErr } = await sb
      .from("fin_ar_invoice")
      .select("external_id, result")
      .not("external_id", "is", null);
    if (exErr) throw new Error(`fin_ar_invoice read failed: ${exErr.message}`);
    const known = new Map<string, string>(
      (existing ?? []).map((r) => [r.external_id as string, r.result as string]),
    );

    let written = 0;
    for (const inv of open) {
      const qbOwned = {
        customer: inv.CustomerRef?.name ?? inv.CustomerRef?.value ?? "Unknown",
        invoice_num: inv.DocNumber ?? null,
        invoice_date: inv.TxnDate ?? null,
        open_balance: inv.Balance ?? 0,
        due_date: inv.DueDate ?? null,
        updated_at: new Date().toISOString(),
      };
      if (known.has(inv.Id)) {
        const { error } = await sb
          .from("fin_ar_invoice")
          .update(qbOwned)
          .eq("external_id", inv.Id);
        if (error) throw new Error(`fin_ar_invoice update failed: ${error.message}`);
      } else {
        const { error } = await sb.from("fin_ar_invoice").insert({
          ...qbOwned,
          external_id: inv.Id,
          expected_receipt_date: inv.DueDate ?? null,
          result: "planned",
        });
        if (error) throw new Error(`fin_ar_invoice insert failed: ${error.message}`);
      }
      written++;
    }

    // Close out QB rows that are no longer open (paid in QuickBooks).
    // Writeoffs flagged by the finance team stay as-is.
    const openIds = new Set(open.map((i) => i.Id));
    const nowPaid = Array.from(known.entries())
      .filter(([id, result]) => !openIds.has(id) && result !== "paid" && result !== "writeoff")
      .map(([id]) => id);
    if (nowPaid.length) {
      const { error } = await sb
        .from("fin_ar_invoice")
        .update({ result: "paid", open_balance: 0, updated_at: new Date().toISOString() })
        .in("external_id", nowPaid);
      if (error) throw new Error(`fin_ar_invoice paid-close failed: ${error.message}`);
      written += nowPaid.length;
    }

    await logSync("ar", "ok", written, nowPaid.length ? `${nowPaid.length} closed as paid` : undefined);
    return written;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logSync("ar", "error", 0, msg);
    throw err;
  }
}
