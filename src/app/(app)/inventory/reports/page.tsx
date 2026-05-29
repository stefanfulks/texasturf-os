import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { InvRoll, RollStatus } from "@/lib/database.types";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory Reports</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Aging, usage variance, and stock value analysis
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Aging */}
        <Link
          href="/inventory/reports/aging"
          className="group rounded-xl border border-zinc-200 bg-white p-6 hover:border-zinc-400 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 group-hover:underline">
                Aging Report
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                How long available rolls have been sitting
              </p>
            </div>
            <span className="text-zinc-300 group-hover:text-zinc-600">→</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-zinc-900">{totalAvailable}</p>
              <p className="text-xs text-zinc-400">available rolls</p>
            </div>
            {oldRolls.length > 0 && (
              <p className="text-xs text-amber-700">
                {oldRolls.length} sitting 91+ days · {Math.round(oldRollFt).toLocaleString()} ft
              </p>
            )}
          </div>
        </Link>

        {/* Overage */}
        <Link
          href="/inventory/reports/overage"
          className="group rounded-xl border border-zinc-200 bg-white p-6 hover:border-zinc-400 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 group-hover:underline">
                Turf Overage
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Requested vs dispatched per completed job
              </p>
            </div>
            <span className="text-zinc-300 group-hover:text-zinc-600">→</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-zinc-900">{completedJobs ?? 0}</p>
              <p className="text-xs text-zinc-400">completed jobs</p>
            </div>
          </div>
        </Link>

        {/* Inventory snapshot */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">In-Stock Snapshot</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Available + allocated</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-zinc-900">
                {Math.round(totalLinearFt).toLocaleString()}
              </p>
              <p className="text-xs text-zinc-400">linear ft</p>
            </div>
            <p className="text-xs text-zinc-500">{inStockCount} rolls in stock</p>
          </div>
        </div>
      </div>
    </div>
  );
}
