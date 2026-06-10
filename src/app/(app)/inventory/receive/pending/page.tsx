import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { RollStatusBadge } from "@/components/inventory/roll-status-badge";
import { PendingRollActions } from "./pending-actions";
import type { InvRoll, Vendor } from "@/lib/db-helpers.types";

function fmtFt(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " ft";
}

function relativeTime(iso: string) {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export default async function PendingInventoryPage() {
  const supabase = await createClient();

  const { data: rollsData } = await supabase
    .from("inv_rolls")
    .select(
      "id, tt_sku_tag_number, manufacturer_roll_number, product_name, current_length_ft, width_ft, dye_lot, vendor_id, status, notes, created_at",
    )
    .eq("status", "planned")
    .order("created_at", { ascending: false });

  const rolls = (rollsData ?? []) as unknown as Pick<
    InvRoll,
    | "id"
    | "tt_sku_tag_number"
    | "manufacturer_roll_number"
    | "product_name"
    | "current_length_ft"
    | "width_ft"
    | "dye_lot"
    | "vendor_id"
    | "status"
    | "notes"
    | "created_at"
  >[];

  const vendorIds = [...new Set(rolls.map((r) => r.vendor_id).filter(Boolean) as string[])];
  let vendorLookup = new Map<string, string>();
  if (vendorIds.length > 0) {
    const { data: vendorData } = await supabase
      .from("vendors")
      .select("id, name")
      .in("id", vendorIds);
    vendorLookup = new Map(
      ((vendorData ?? []) as unknown as Pick<Vendor, "id" | "name">[]).map((v) => [v.id, v.name]),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link
            href="/inventory/receive"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to Receive
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Pending Inventory</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Rolls received in Planned status. Confirm to release into Available, or reject as
            damaged.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        {rolls.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-zinc-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-zinc-500 font-medium">No pending rolls</p>
            <p className="text-xs text-zinc-400 mt-1">
              All received rolls are either available or reviewed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-600">TT SKU</th>
                  <th className="px-4 py-3 font-medium text-zinc-600">Mfr #</th>
                  <th className="px-4 py-3 font-medium text-zinc-600">Product</th>
                  <th className="px-4 py-3 font-medium text-zinc-600">Length</th>
                  <th className="px-4 py-3 font-medium text-zinc-600">Vendor</th>
                  <th className="px-4 py-3 font-medium text-zinc-600">Status</th>
                  <th className="px-4 py-3 font-medium text-zinc-600">Created</th>
                  <th className="px-4 py-3 font-medium text-zinc-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rolls.map((roll) => (
                  <tr key={roll.id}>
                    <td className="px-4 py-3 font-mono text-zinc-800">
                      {roll.tt_sku_tag_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {roll.manufacturer_roll_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-800">
                      <div>{roll.product_name ?? "—"}</div>
                      {roll.dye_lot && (
                        <div className="text-xs text-zinc-400 mt-0.5">Dye lot {roll.dye_lot}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{fmtFt(roll.current_length_ft)}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      {roll.vendor_id ? vendorLookup.get(roll.vendor_id) ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RollStatusBadge status={roll.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {relativeTime(roll.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PendingRollActions rollId={roll.id} rollTag={roll.tt_sku_tag_number} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
