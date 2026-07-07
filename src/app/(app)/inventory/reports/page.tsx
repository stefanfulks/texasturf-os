import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { InvRoll, RollStatus } from "@/lib/db-helpers.types";

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function InventoryReportsPage() {
  const supabase = await createClient();

  // Aging: available rolls 91+ days old
  const { data: availableRollsRaw } = await supabase
    .from("inv_rolls")
    .select("id, current_length_ft, created_at, status")
    .eq("status", "available");

  const availableRolls = (availableRollsRaw ?? []) as Pick<
    InvRoll,
    "id" | "current_length_ft" | "created_at" | "status"
  >[];

  const totalAvailable = availableRolls.length;
  const oldRolls = availableRolls.filter((r) => daysSince(r.created_at) >= 91);
  const oldRollFt = oldRolls.reduce((s, r) => s + (r.current_length_ft ?? 0), 0);

  // Overage: completed jobs count
  const { count: completedJobs } = await supabase
    .from("inv_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  // Inventory value (just rolls count + linear ft for now since cost isn't stored on inv_products)
  const inStockStatuses: RollStatus[] = ["available", "allocated"];
  const { data: inStockRaw } = await supabase
    .from("inv_rolls")
    .select("current_length_ft, status")
    .in("status", inStockStatuses);

  const totalLinearFt = (inStockRaw ?? []).reduce(
    (s, r) => s + (r.current_length_ft ?? 0),
    0,
  );
  const inStockCount = inStockRaw?.length ?? 0;

  return (
    <div className="space-y-6">
      <Link href="/inventory" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        ← Inventory
      </Link>
      <div>
        <h1 className="page-title">Inventory Reports</h1>
        <p className="text-sm text-ink-3 mt-0.5">
          Aging, usage variance, and stock value analysis
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Aging */}
        <Link
          href="/inventory/reports/aging"
          className="group card p-6 hover:border-line-strong hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-ink group-hover:underline">
                Aging Report
              </h2>
              <p className="text-xs text-ink-3 mt-0.5">
                How long available rolls have been sitting
              </p>
            </div>
            <span className="text-ink-4 group-hover:text-ink-2">→</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-ink">{totalAvailable}</p>
              <p className="text-xs text-ink-4">available rolls</p>
            </div>
            {oldRolls.length > 0 && (
              <p className="text-xs text-warn">
                {oldRolls.length} sitting 91+ days · {Math.round(oldRollFt).toLocaleString()} ft
              </p>
            )}
          </div>
        </Link>

        {/* Overage */}
        <Link
          href="/inventory/reports/overage"
          className="group card p-6 hover:border-line-strong hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-ink group-hover:underline">
                Turf Overage
              </h2>
              <p className="text-xs text-ink-3 mt-0.5">
                Requested vs dispatched per completed job
              </p>
            </div>
            <span className="text-ink-4 group-hover:text-ink-2">→</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-ink">{completedJobs ?? 0}</p>
              <p className="text-xs text-ink-4">completed jobs</p>
            </div>
          </div>
        </Link>

        {/* Inventory snapshot */}
        <div className="card p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">In-Stock Snapshot</h2>
              <p className="text-xs text-ink-3 mt-0.5">Available + allocated</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-ink">
                {Math.round(totalLinearFt).toLocaleString()}
              </p>
              <p className="text-xs text-ink-4">linear ft</p>
            </div>
            <p className="text-xs text-ink-3">{inStockCount} rolls in stock</p>
          </div>
        </div>
      </div>
    </div>
  );
}
