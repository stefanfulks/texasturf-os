import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Ruler, Layers, Activity } from "lucide-react";
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
} from "@/lib/db-helpers.types";

// ─── Allocation status pill ───────────────────────────────────────────────────

const ALLOC_STATUS_STYLES: Record<string, string> = {
  requested:  "bg-hover text-ink-2 border-line",
  allocated:  "bg-info-tint text-info border-info/30",
  staged:     "bg-info-tint text-info border-info/30",
  dispatched: "bg-warn-tint text-warn border-warn/30",
  completed:  "bg-brand-tint text-brand border-brand/30",
  cancelled:  "bg-danger-tint text-danger border-danger/30",
};

function AllocStatusBadge({ status }: { status: string }) {
  const classes = ALLOC_STATUS_STYLES[status] ?? "bg-hover text-ink-2 border-line";
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
    <div className="space-y-6">
      <Link
        href="/inventory/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
      >
        ← Jobs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">
              {job.job_number ? `${job.job_number} · ` : ""}
              {job.job_name}
            </h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="text-sm text-ink-3">
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
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-info/30 bg-info-tint text-info hover:bg-info-tint"
                >
                  Mark In Progress
                </button>
              </form>
            )}
            {(job.status === "planning" || job.status === "in_progress") && (
              <form action={stagedAction}>
                <button
                  type="submit"
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-info/30 bg-info-tint text-info hover:bg-info-tint"
                >
                  Mark Staged
                </button>
              </form>
            )}
            {!isCompleted && (
              <form action={completedAction}>
                <button
                  type="submit"
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-brand/30 bg-brand-tint text-brand hover:bg-brand-tint"
                >
                  Mark Completed
                </button>
              </form>
            )}
            <form action={archiveAction}>
              <button
                type="submit"
                className="px-3 py-2 text-sm font-medium rounded-lg border border-line-strong bg-white text-ink-2 hover:bg-hover"
              >
                Archive
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Total Allocations</p>
          <p className="text-xl font-semibold">{totalAllocations}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Allocated Rolls</p>
          <p className="text-xl font-semibold">{allocatedRolls}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Total Requested</p>
          <p className="text-xl font-semibold">{totalRequestedFt.toLocaleString()} ft</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Total Dispatched</p>
          <p className="text-xl font-semibold">{totalDispatchedFt.toLocaleString()} ft</p>
        </div>
      </div>

      {/* Allocations table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h2 className="text-sm font-semibold">Allocations</h2>
          {!isArchived && (
            <Link
              href={`/inventory/jobs/${id}/allocations/new`}
              className="text-xs text-ink-3 hover:text-ink"
            >
              + Add Allocation
            </Link>
          )}
        </div>
        {allocations.length === 0 ? (
          <div className="empty-state">
            <span className="medallion"><Ruler className="h-5 w-5" /></span>
            <p className="empty-state-title">No allocations yet</p>
            <p className="empty-state-body">Add an allocation to reserve turf for this job.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-hover">
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Width</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Requested (ft)</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Dye Lot Pref</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Roll</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => {
                  const roll = a.roll_id ? rollById.get(a.roll_id) ?? null : null;
                  const deleteAction    = deleteAllocation.bind(null, a.id);
                  const unassignAction  = unassignRoll.bind(null, a.id);

                  return (
                    <tr key={a.id} className="border-b border-line">
                      <td className="px-4 py-3 text-ink-2 font-medium">
                        {a.product_name ?? <span className="text-ink-4">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-2">
                        {a.width_ft != null ? `${a.width_ft} ft` : <span className="text-ink-4">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-2">
                        {a.requested_length_ft != null ? a.requested_length_ft.toLocaleString() : <span className="text-ink-4">—</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-2">
                        {a.dye_lot_preference ?? <span className="text-ink-4">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {roll ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs text-ink">{roll.tt_sku_tag_number ?? roll.id.slice(0, 8)}</span>
                            <RollStatusBadge status={roll.status as RollStatus} />
                          </div>
                        ) : (
                          <span className="text-ink-4 text-xs">Not assigned</span>
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
                                className="text-xs px-2.5 py-1 rounded-md border border-line-strong bg-white text-ink-2 hover:border-line-strong"
                              >
                                Assign Roll
                              </Link>
                            ) : (
                              <>
                                <Link
                                  href={`/inventory/jobs/${id}/allocations/${a.id}/assign?swap=1`}
                                  className="text-xs px-2.5 py-1 rounded-md border border-line-strong bg-white text-ink-2 hover:border-line-strong"
                                >
                                  Swap Roll
                                </Link>
                                <form action={unassignAction}>
                                  <button
                                    type="submit"
                                    className="text-xs px-2.5 py-1 rounded-md border border-line bg-white text-ink-3 hover:text-ink hover:border-line-strong"
                                  >
                                    Unassign
                                  </button>
                                </form>
                              </>
                            )}
                            <form action={deleteAction}>
                              <button
                                type="submit"
                                className="text-xs px-2.5 py-1 rounded-md text-danger hover:text-danger"
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
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line">
          <h2 className="text-sm font-semibold">Rolls Assigned to Job</h2>
        </div>
        {rolls.length === 0 ? (
          <div className="empty-state">
            <span className="medallion"><Layers className="h-5 w-5" /></span>
            <p className="empty-state-title">No rolls assigned</p>
            <p className="empty-state-body">Assign rolls from an allocation and they&rsquo;ll show up here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-hover">
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">SKU Tag</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Width</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Length</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Dye Lot</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {rolls.map((r) => (
                  <tr key={r.id} className="border-b border-line">
                    <td className="px-4 py-3 font-mono text-xs text-ink">{r.tt_sku_tag_number ?? r.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-ink-2">{r.product_name ?? <span className="text-ink-4">—</span>}</td>
                    <td className="px-4 py-3 text-right text-ink-2">{r.width_ft != null ? `${r.width_ft} ft` : "—"}</td>
                    <td className="px-4 py-3 text-right text-ink-2">{r.current_length_ft != null ? `${r.current_length_ft.toLocaleString()} ft` : "—"}</td>
                    <td className="px-4 py-3 text-ink-2">{r.dye_lot ?? <span className="text-ink-4">—</span>}</td>
                    <td className="px-4 py-3"><RollStatusBadge status={r.status as RollStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line">
          <h2 className="text-sm font-semibold">Transaction History</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="empty-state">
            <span className="medallion"><Activity className="h-5 w-5" /></span>
            <p className="empty-state-title">No transactions recorded</p>
            <p className="empty-state-body">Pulls, cuts, and returns for this job will appear here as they happen.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-hover">
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">When</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Roll</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">From → To</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Qty (ft)</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const roll = t.roll_id ? rollById.get(t.roll_id) : null;
                  return (
                    <tr key={t.id} className="border-b border-line">
                      <td className="px-4 py-3 text-ink-3 text-xs whitespace-nowrap">
                        {format(parseISO(t.created_at), "MMM d, h:mma")}
                      </td>
                      <td className="px-4 py-3 text-ink-2 font-medium">{t.transaction_type}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-2">
                        {roll?.tt_sku_tag_number ?? (t.roll_id ? t.roll_id.slice(0, 8) : <span className="text-ink-4">—</span>)}
                      </td>
                      <td className="px-4 py-3 text-ink-3 text-xs">
                        {t.from_status ?? "—"} → {t.to_status ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-2">
                        {t.quantity_ft != null ? t.quantity_ft.toLocaleString() : <span className="text-ink-4">—</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-3 text-xs">
                        {t.notes ?? <span className="text-ink-4">—</span>}
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
        <div className="card p-6">
          <h2 className="text-sm font-semibold mb-4">Edit Job</h2>
          <JobForm mode="edit" job={job} />
        </div>
      )}
    </div>
  );
}
