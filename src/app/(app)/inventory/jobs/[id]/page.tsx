import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { JobStatusBadge } from "@/components/inventory/job-status-badge";
import { RollStatusBadge } from "@/components/inventory/roll-status-badge";
import { JobForm } from "../job-form";
import {
  markJobInProgress,
  markJobStaged,
  markJobCompleted,
  archiveJob,
  deleteAllocation,
  unassignRoll,
} from "../actions";
import type {
  InvJob,
  InvAllocation,
  InvRoll,
  InvTransaction,
  RollStatus,
} from "@/lib/database.types";

// ─── Allocation status pill ───────────────────────────────────────────────────

const ALLOC_STATUS_STYLES: Record<string, string> = {
  requested:  "bg-zinc-50 text-zinc-700 border-zinc-200",
  allocated:  "bg-blue-50 text-blue-700 border-blue-200",
  staged:     "bg-sky-50 text-sky-700 border-sky-200",
  dispatched: "bg-amber-50 text-amber-800 border-amber-200",
  completed:  "bg-green-50 text-green-700 border-green-200",
  cancelled:  "bg-red-50 text-red-700 border-red-200",
};

function AllocStatusBadge({ status }: { status: string }) {
  const classes = ALLOC_STATUS_STYLES[status] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${classes}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Multi-FK joins: fetch separately and stitch in JS.
  const [jobRes, allocsRes, rollsRes, txRes] = await Promise.all([
    supabase.from("inv_jobs").select("*").eq("id", id).single(),
    supabase.from("inv_allocations")
      .select("*")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("inv_rolls")
      .select("*")
      .eq("allocated_job_id", id),
    supabase.from("inv_transactions")
      .select("*")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!jobRes.data) notFound();

  const job          = jobRes.data as InvJob;
  const allocations  = (allocsRes.data ?? []) as InvAllocation[];
  const rolls        = (rollsRes.data ?? []) as InvRoll[];
  const transactions = (txRes.data ?? []) as InvTransaction[];

  // Creator profile (separate fetch — multi-FK to profiles).
  let creatorName: string | null = null;
  if (job.created_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", job.created_by)
      .single();
    creatorName = profile?.full_name ?? profile?.email ?? null;
  }

  // Build a lookup of allocation -> assigned roll (if any) so we can render details.
  const rollById = new Map(rolls.map((r) => [r.id, r]));
  // For allocations whose assigned roll isn't in the rolls[] (e.g. status changed already),
  // fetch missing rolls separately.
  const missingRollIds = allocations
    .map((a) => a.roll_id)
    .filter((rid): rid is string => !!rid && !rollById.has(rid));
  if (missingRollIds.length > 0) {
    const { data: extraRolls } = await supabase
      .from("inv_rolls")
      .select("*")
      .in("id", missingRollIds);
    for (const r of (extraRolls ?? []) as InvRoll[]) {
      rollById.set(r.id, r);
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const totalAllocations  = allocations.length;
  const allocatedRolls    = allocations.filter((a) => !!a.roll_id).length;
  const totalRequestedFt  = allocations.reduce((s, a) => s + (a.requested_length_ft ?? 0), 0);
  const totalDispatchedFt = transactions
    .filter((t) => t.transaction_type === "dispatch")
    .reduce((s, t) => s + (t.quantity_ft ?? 0), 0);

  // ── Bound server actions for workflow buttons ───────────────────────────────
  const inProgressAction = markJobInProgress.bind(null, id);
  const stagedAction     = markJobStaged.bind(null, id);
  const completedAction  = markJobCompleted.bind(null, id);
  const archiveAction    = archiveJob.bind(null, id);

  const isArchived  = job.status === "archived";
  const isCompleted = job.status === "completed";

  return (
    <div className="max-w-6xl space-y-6">
      <Link
        href="/inventory/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Jobs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">
              {job.job_number ? `${job.job_number} · ` : ""}
              {job.job_name}
            </h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="text-sm text-zinc-500">
            {job.site_address ?? "No site address"}
            {job.scheduled_date && ` · Scheduled ${format(parseISO(job.scheduled_date), "MMM d, yyyy")}`}
            {job.completion_date && ` · Completed ${format(parseISO(job.completion_date), "MMM d, yyyy")}`}
            {creatorName && ` · Created by ${creatorName}`}
          </p>
        </div>

        {/* Status workflow buttons */}
        {!isArchived && (
          <div className="flex items-center gap-2 flex-wrap">
            {job.status === "planning" && (
              <form action={inProgressAction}>
                <button
                  type="submit"
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  Mark In Progress
                </button>
              </form>
            )}
            {(job.status === "planning" || job.status === "in_progress") && (
              <form action={stagedAction}>
                <button
                  type="submit"
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
                >
                  Mark Staged
                </button>
              </form>
            )}
            {!isCompleted && (
              <form action={completedAction}>
                <button
                  type="submit"
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                >
                  Mark Completed
                </button>
              </form>
            )}
            <form action={archiveAction}>
              <button
                type="submit"
                className="px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
              >
                Archive
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Total Allocations</p>
          <p className="text-xl font-semibold">{totalAllocations}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Allocated Rolls</p>
          <p className="text-xl font-semibold">{allocatedRolls}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Total Requested</p>
          <p className="text-xl font-semibold">{totalRequestedFt.toLocaleString()} ft</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Total Dispatched</p>
          <p className="text-xl font-semibold">{totalDispatchedFt.toLocaleString()} ft</p>
        </div>
      </div>

      {/* Allocations table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold">Allocations</h2>
          {!isArchived && (
            <Link
              href={`/inventory/jobs/${id}/allocations/new`}
              className="text-xs text-zinc-500 hover:text-zinc-900"
            >
              + Add Allocation
            </Link>
          )}
        </div>
        {allocations.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400">No allocations yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Width</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Requested (ft)</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Dye Lot Pref</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Roll</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => {
                  const roll = a.roll_id ? rollById.get(a.roll_id) ?? null : null;
                  const deleteAction    = deleteAllocation.bind(null, a.id);
                  const unassignAction  = unassignRoll.bind(null, a.id);

                  return (
                    <tr key={a.id} className="border-b border-zinc-50">
                      <td className="px-4 py-3 text-zinc-700 font-medium">
                        {a.product_name ?? <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600">
                        {a.width_ft != null ? `${a.width_ft} ft` : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700">
                        {a.requested_length_ft != null ? a.requested_length_ft.toLocaleString() : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {a.dye_lot_preference ?? <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {roll ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs text-zinc-800">{roll.tt_sku_tag_number ?? roll.id.slice(0, 8)}</span>
                            <RollStatusBadge status={roll.status as RollStatus} />
                          </div>
                        ) : (
                          <span className="text-zinc-300 text-xs">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AllocStatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isArchived && !isCompleted && (
                          <div className="flex items-center justify-end gap-2">
                            {!a.roll_id ? (
                              <Link
                                href={`/inventory/jobs/${id}/allocations/${a.id}/assign`}
                                className="text-xs px-2.5 py-1 rounded-md border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
                              >
                                Assign Roll
                              </Link>
                            ) : (
                              <>
                                <Link
                                  href={`/inventory/jobs/${id}/allocations/${a.id}/assign?swap=1`}
                                  className="text-xs px-2.5 py-1 rounded-md border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
                                >
                                  Swap Roll
                                </Link>
                                <form action={unassignAction}>
                                  <button
                                    type="submit"
                                    className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900 hover:border-zinc-400"
                                  >
                                    Unassign
                                  </button>
                                </form>
                              </>
                            )}
                            <form action={deleteAction}>
                              <button
                                type="submit"
                                className="text-xs px-2.5 py-1 rounded-md text-red-600 hover:text-red-800"
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rolls assigned table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold">Rolls Assigned to Job</h2>
        </div>
        {rolls.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400">No rolls currently assigned to this job.</div>
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
                </tr>
              </thead>
              <tbody>
                {rolls.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-50">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-800">{r.tt_sku_tag_number ?? r.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-zinc-700">{r.product_name ?? <span className="text-zinc-300">—</span>}</td>
                    <td className="px-4 py-3 text-right text-zinc-600">{r.width_ft != null ? `${r.width_ft} ft` : "—"}</td>
                    <td className="px-4 py-3 text-right text-zinc-600">{r.current_length_ft != null ? `${r.current_length_ft.toLocaleString()} ft` : "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{r.dye_lot ?? <span className="text-zinc-300">—</span>}</td>
                    <td className="px-4 py-3"><RollStatusBadge status={r.status as RollStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold">Transaction History</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400">No transactions recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">When</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Roll</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">From → To</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Qty (ft)</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const roll = t.roll_id ? rollById.get(t.roll_id) : null;
                  return (
                    <tr key={t.id} className="border-b border-zinc-50">
                      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                        {format(parseISO(t.created_at), "MMM d, h:mma")}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 font-medium">{t.transaction_type}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                        {roll?.tt_sku_tag_number ?? (t.roll_id ? t.roll_id.slice(0, 8) : <span className="text-zinc-300">—</span>)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">
                        {t.from_status ?? "—"} → {t.to_status ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700">
                        {t.quantity_ft != null ? t.quantity_ft.toLocaleString() : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">
                        {t.notes ?? <span className="text-zinc-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit form */}
      {!isArchived && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold mb-4">Edit Job</h2>
          <JobForm mode="edit" job={job} />
        </div>
      )}
    </div>
  );
}
