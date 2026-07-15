/**
 * QuickBooks AP aging → fin_ap_bill.
 *
 * Open bills (Balance > 0) upsert on external_id (= QB bill id). Planning
 * fields the finance team edits (expected_pay_date, payment_type) are only
 * seeded on first insert — re-syncs update the QB-owned columns and leave
 * the plan alone. QB-sourced rows that drop out of the open set are zeroed
 * (paid in QuickBooks).
 *
 * Service-role client only — never in a user-reachable path.
 */

import { qbQueryAll } from "../api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logSync } from "./log";

type QbBill = {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  Balance?: number;
  VendorRef?: { value: string; name?: string };
};

export async function syncApBills(realmId: string): Promise<number> {
  try {
    const open = await qbQueryAll<QbBill>(realmId, "Bill", "Balance > '0'");
    const sb = supabaseAdmin();

    const { data: existing, error: exErr } = await sb
      .from("fin_ap_bill")
      .select("external_id, open_balance")
      .not("external_id", "is", null);
    if (exErr) throw new Error(`fin_ap_bill read failed: ${exErr.message}`);
    const known = new Map<string, number>(
      (existing ?? []).map((r) => [r.external_id as string, Number(r.open_balance)]),
    );

    let written = 0;
    for (const bill of open) {
      const qbOwned = {
        vendor: bill.VendorRef?.name ?? bill.VendorRef?.value ?? "Unknown",
        bill_num: bill.DocNumber ?? null,
        invoice_date: bill.TxnDate ?? null,
        open_balance: bill.Balance ?? 0,
        due_date: bill.DueDate ?? null,
        updated_at: new Date().toISOString(),
      };
      if (known.has(bill.Id)) {
        const { error } = await sb
          .from("fin_ap_bill")
          .update(qbOwned)
          .eq("external_id", bill.Id);
        if (error) throw new Error(`fin_ap_bill update failed: ${error.message}`);
      } else {
        const { error } = await sb.from("fin_ap_bill").insert({
          ...qbOwned,
          external_id: bill.Id,
          expected_pay_date: bill.DueDate ?? null,
          payment_type: "cash",
        });
        if (error) throw new Error(`fin_ap_bill insert failed: ${error.message}`);
      }
      written++;
    }

    // Zero out QB rows that are no longer open (paid in QuickBooks).
    const openIds = new Set(open.map((b) => b.Id));
    const nowPaid = Array.from(known.entries())
      .filter(([id, balance]) => !openIds.has(id) && balance !== 0)
      .map(([id]) => id);
    if (nowPaid.length) {
      const { error } = await sb
        .from("fin_ap_bill")
        .update({ open_balance: 0, updated_at: new Date().toISOString() })
        .in("external_id", nowPaid);
      if (error) throw new Error(`fin_ap_bill paid-close failed: ${error.message}`);
      written += nowPaid.length;
    }

    await logSync("ap", "ok", written, nowPaid.length ? `${nowPaid.length} zeroed as paid` : undefined);
    return written;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logSync("ap", "error", 0, msg);
    throw err;
  }
}
