import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RollStatusBadge } from "@/components/inventory/roll-status-badge";
import { assignRoll, swapRoll } from "../../../../actions";
import type { InvJob, InvAllocation, InvRoll, RollStatus } from "@/lib/database.types";

export default async function AssignRollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; alloc_id: string }>;
  searchParams: Promise<{ swap?: string }>;
}) {
  const { id, alloc_id } = await params;
  const { swap } = await searchParams;
  const isSwap = swap === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [jobRes, allocRes] = await Promise.all([
    supabase.from("inv_jobs").select("id, job_number, job_name").eq("id", id).single(),
    supabase.from("inv_allocations").select("*").eq("id", alloc_id).single(),
  ]);

  if (!jobRes.data || !allocRes.data) notFound();
  const job   = jobRes.data as Pick<InvJob, "id" | "job_number" | "job_name">;
  const alloc = allocRes.data as InvAllocation;

  if (alloc.job_id !== id) notFound();

  // ── Build the candidate-roll query ──────────────────────────────────────────
  // - status = available
  // - product match: prefer product_id; otherwise match product_name
  // - width match (if specified)
  // - current_length_ft >= requested_length_ft (if specified)
  // - optional dye_lot match
  let candidateQuery = supabase
    .from("inv_rolls")
    .select("*")
    .eq("status", "available");

  if (alloc.product_id) {
    candidateQuery = candidateQuery.eq("product_id", alloc.product_id);
  } else if (alloc.product_name) {
    candidateQuery = candidateQuery.eq("product_name", alloc.product_name);
  }

  if (alloc.width_ft != null) {
    candidateQuery = candidateQuery.eq("width_ft", alloc.width_ft);
  }

  if (alloc.requested_length_ft != null) {
    candidateQuery = candidateQuery.gte("current_length_ft", alloc.requested_length_ft);
  }

  if (alloc.dye_lot_preference) {
    candidateQuery = candidateQuery.eq("dye_lot", alloc.dye_lot_preference);
  }

  const { data: candidatesRaw } = await candidateQuery.order("current_length_ft", { ascending: true });
  const candidates = (candidatesRaw ?? []) as InvRoll[];

  // Look up the current roll (for swap context)
  let currentRoll: InvRoll | null = null;
  if (isSwap && alloc.roll_id) {
    const { data } = await supabase.from("inv_rolls").select("*").eq("id", alloc.roll_id).single();
    currentRoll = (data ?? null) as InvRoll | null;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href={`/inventory/jobs/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← {job.job_number ? `${job.job_number} · ` : ""}{job.job_name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isSwap ? "Swap Roll" : "Assign Roll"}
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {alloc.product_name ?? "Unspecified product"}
          {alloc.width_ft != null && ` · ${alloc.width_ft} ft wide`}
          {alloc.requested_length_ft != null && ` · ${alloc.requested_length_ft} ft requested`}
          {alloc.dye_lot_preference && ` · dye lot ${alloc.dye_lot_preference}`}
        </p>
      </div>

      {isSwap && currentRoll && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800 mb-1">Currently assigned roll</p>
          <p className="font-mono text-sm font-semibold text-zinc-900">
            {currentRoll.tt_sku_tag_number ?? currentRoll.id.slice(0, 8)}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            {currentRoll.width_ft != null ? `${currentRoll.width_ft} ft × ` : ""}
            {currentRoll.current_length_ft != null ? `${currentRoll.current_length_ft} ft` : ""}
            {currentRoll.dye_lot ? ` · dye lot ${currentRoll.dye_lot}` : ""}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold">
            Candidate Rolls <span className="text-zinc-400 font-normal">({candidates.length})</span>
          </h2>
        </div>
        {candidates.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">
            No matching available rolls. Try adjusting the allocation specs or receiving more inventory.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">SKU Tag</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Width</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Length</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Dye Lot</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((roll) => {
                  const action = isSwap
                    ? swapRoll.bind(null, alloc.id, roll.id)
                    : assignRoll.bind(null, alloc.id, roll.id);
                  return (
                    <tr key={roll.id} className="border-b border-zinc-50">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-800">
                        {roll.tt_sku_tag_number ?? roll.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{roll.product_name ?? <span className="text-zinc-300">—</span>}</td>
                      <td className="px-4 py-3 text-right text-zinc-600">{roll.width_ft != null ? `${roll.width_ft} ft` : "—"}</td>
                      <td className="px-4 py-3 text-right text-zinc-700 font-medium">
                        {roll.current_length_ft != null ? `${roll.current_length_ft.toLocaleString()} ft` : "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{roll.dye_lot ?? <span className="text-zinc-300">—</span>}</td>
                      <td className="px-4 py-3"><RollStatusBadge status={roll.status as RollStatus} /></td>
                      <td className="px-4 py-3 text-right">
                        <form action={action}>
                          <button
                            type="submit"
                            className="text-xs px-3 py-1.5 rounded-md bg-zinc-900 text-white font-medium hover:bg-zinc-700"
                          >
                            {isSwap ? "Swap to this roll" : "Assign"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
