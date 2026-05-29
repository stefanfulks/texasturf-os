import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { formatDistanceToNowStrict, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { RollStatusBadge } from "@/components/inventory/roll-status-badge";
import { PendingReturnActions } from "./pending-returns-actions";
import type { InvRoll, InvJob, InvTransaction } from "@/lib/database.types";

function fmtLen(n: number | null | undefined) {
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

function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "MMM d");
  } catch {
    return "—";
  }
}

export default async function PendingReturnsPage() {
  const supabase = await createClient();

  const { data: rollsData } = await supabase
    .from("inv_rolls")
    .select(
      "id, tt_sku_tag_number, product_name, current_length_ft, width_ft, dye_lot, status, notes, updated_at",
    )
    .eq("status", "returned")
    .order("updated_at", { ascending: false });

  const rolls = (rollsData ?? []) as unknown as Pick<
    InvRoll,
    | "id"
    | "tt_sku_tag_number"
    | "product_name"
    | "current_length_ft"
    | "width_ft"
    | "dye_lot"
    | "status"
    | "notes"
    | "updated_at"
  >[];

  // Derive the source job per roll from the latest 'return' transaction.
  const rollIds = rolls.map((r) => r.id);
  const returnTxByRoll = new Map<string, { job_id: string | null; created_at: string }>();
  if (rollIds.length > 0) {
    const { data: txData } = await supabase
      .from("inv_transactions")
      .select("roll_id, job_id, transaction_type, created_at")
      .in("roll_id", rollIds)
      .in("transaction_type", ["return", "return_unmarked"])
      .order("created_at", { ascending: false });

    const txs = (txData ?? []) as unknown as Pick<
      InvTransaction,
      "roll_id" | "job_id" | "transaction_type" | "created_at"
    >[];
    for (const tx of txs) {
      if (!tx.roll_id) continue;
      if (!returnTxByRoll.has(tx.roll_id)) {
        returnTxByRoll.set(tx.roll_id, { job_id: tx.job_id, created_at: tx.created_at });
      }
    }
  }

  const jobIds = [
    ...new Set(
      Array.from(returnTxByRoll.values())
        .map((t) => t.job_id)
        .filter(Boolean) as string[],
    ),
  ];
  const jobLookup = new Map<string, Pick<InvJob, "id" | "job_number" | "job_name">>();
  if (jobIds.length > 0) {
    const { data: jobData } = await supabase
      .from("inv_jobs")
      .select("id, job_number, job_name")
      .in("id", jobIds);
    for (const j of (jobData ?? []) as unknown as Pick<
      InvJob,
      "id" | "job_number" | "job_name"
    >[]) {
      jobLookup.set(j.id, j);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/inventory/returns"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to Returns
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900">Pending Returns Review</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Rolls in Returned status awaiting review. Restock to Available or write off as Damaged.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        {rolls.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardCheck className="w-10 h-10 text-zinc-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-zinc-500 font-medium">Nothing to review</p>
            <p className="text-xs text-zinc-400 mt-1">
              Returned rolls will appear here for triage.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-600">TT SKU</th>
                  <th className="px-4 py-3 font-medium text-zinc-600">Product</th>
                  <th className="px-4 py-3 font-medium text-zinc-600">Length</th>
                  <th className="px-4 py-3 font-medium text-zinc-600">Source job</th>
                  <th className="px-4 py-3 font-medium text-zinc-600">Returned</th>
                  <th className="px-4 py-3 font-medium text-zinc-600">Status</th>
                  <th className="px-4 py-3 font-medium text-zinc-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rolls.map((roll) => {
                  const tx = returnTxByRoll.get(roll.id);
                  const job = tx?.job_id ? jobLookup.get(tx.job_id) ?? null : null;

                  return (
                    <tr key={roll.id}>
                      <td className="px-4 py-3 font-mono text-zinc-800">
                        {roll.tt_sku_tag_number ?? roll.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-zinc-800">
                        <div>{roll.product_name ?? "—"}</div>
                        {roll.dye_lot && (
                          <div className="text-xs text-zinc-400 mt-0.5">
                            Dye lot {roll.dye_lot}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {fmtLen(roll.current_length_ft)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {job ? (
                          <Link
                            href={`/inventory/jobs/${job.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {job.job_number ?? job.job_name}
                          </Link>
                        ) : tx ? (
                          <span className="text-zinc-400 italic">Unmarked</span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        <div>{shortDate(tx?.created_at ?? roll.updated_at)}</div>
                        <div className="text-zinc-400">
                          {relativeTime(tx?.created_at ?? roll.updated_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RollStatusBadge status={roll.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PendingReturnActions rollId={roll.id} />
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
