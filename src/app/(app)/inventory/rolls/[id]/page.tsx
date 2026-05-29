import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Scissors, Edit } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RollStatusBadge } from "@/components/inventory/roll-status-badge";
import type {
  InvRoll,
  InvJob,
  InvLocation,
  InvProduct,
  InvTransaction,
  InvAllocation,
  Vendor,
} from "@/lib/database.types";

function fmtFt(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ft`;
}

function fmtSqFt(width: number | null | undefined, length: number | null | undefined) {
  if (width == null || length == null) return "—";
  return `${(width * length).toLocaleString("en-US", { maximumFractionDigits: 0 })} sq ft`;
}

export default async function RollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rollData } = await supabase
    .from("inv_rolls")
    .select("*")
    .eq("id", id)
    .single();

  if (!rollData) notFound();
  const roll = rollData as InvRoll;

  // Parallel fetches for related data
  const [
    vendorRes,
    productRes,
    locationRes,
    jobRes,
    parentRes,
    childrenRes,
    transactionsRes,
    allocationsRes,
  ] = await Promise.all([
    roll.vendor_id
      ? supabase.from("vendors").select("id, name").eq("id", roll.vendor_id).single()
      : Promise.resolve({ data: null }),
    roll.product_id
      ? supabase.from("inv_products").select("id, name, sku").eq("id", roll.product_id).single()
      : Promise.resolve({ data: null }),
    roll.location_id
      ? supabase
          .from("inv_locations")
          .select("id, name")
          .eq("id", roll.location_id)
          .single()
      : Promise.resolve({ data: null }),
    roll.allocated_job_id
      ? supabase
          .from("inv_jobs")
          .select("id, job_number, job_name, status")
          .eq("id", roll.allocated_job_id)
          .single()
      : Promise.resolve({ data: null }),
    roll.parent_roll_id
      ? supabase
          .from("inv_rolls")
          .select(
            "id, tt_sku_tag_number, manufacturer_roll_number, product_name, dye_lot, current_length_ft, status",
          )
          .eq("id", roll.parent_roll_id)
          .single()
      : Promise.resolve({ data: null }),
    roll.roll_type === "parent"
      ? supabase
          .from("inv_rolls")
          .select(
            "id, tt_sku_tag_number, dye_lot, width_ft, current_length_ft, status, location_id",
          )
          .eq("parent_roll_id", roll.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("inv_transactions")
      .select("id, transaction_type, from_status, to_status, quantity_ft, notes, created_at, created_by")
      .eq("roll_id", roll.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("inv_allocations")
      .select("id, job_id, status, requested_length_ft, dye_lot_preference, created_at")
      .eq("roll_id", roll.id)
      .order("created_at", { ascending: false }),
  ]);

  const vendor = (vendorRes.data ?? null) as Pick<Vendor, "id" | "name"> | null;
  const product = (productRes.data ?? null) as Pick<
    InvProduct,
    "id" | "name" | "sku"
  > | null;
  const location = (locationRes.data ?? null) as Pick<
    InvLocation,
    "id" | "name"
  > | null;
  const job = (jobRes.data ?? null) as Pick<
    InvJob,
    "id" | "job_number" | "job_name" | "status"
  > | null;
  const parentRoll = (parentRes.data ?? null) as Pick<
    InvRoll,
    | "id"
    | "tt_sku_tag_number"
    | "manufacturer_roll_number"
    | "product_name"
    | "dye_lot"
    | "current_length_ft"
    | "status"
  > | null;
  const childRolls = (childrenRes.data ?? []) as Pick<
    InvRoll,
    "id" | "tt_sku_tag_number" | "dye_lot" | "width_ft" | "current_length_ft" | "status" | "location_id"
  >[];
  const transactions = (transactionsRes.data ?? []) as Pick<
    InvTransaction,
    "id" | "transaction_type" | "from_status" | "to_status" | "quantity_ft" | "notes" | "created_at" | "created_by"
  >[];
  const allocations = (allocationsRes.data ?? []) as Pick<
    InvAllocation,
    "id" | "job_id" | "status" | "requested_length_ft" | "dye_lot_preference" | "created_at"
  >[];

  // Look up actor names for transactions
  const actorIds = [
    ...new Set(transactions.map((t) => t.created_by).filter(Boolean) as string[]),
  ];
  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);
    for (const a of actors ?? []) {
      actorMap.set(a.id, a.full_name ?? a.email ?? a.id.slice(0, 8));
    }
  }

  // Look up job names for allocations
  const allocJobIds = [...new Set(allocations.map((a) => a.job_id))];
  const allocJobMap = new Map<string, { job_number: string | null; job_name: string }>();
  if (allocJobIds.length > 0) {
    const { data: allocJobs } = await supabase
      .from("inv_jobs")
      .select("id, job_number, job_name")
      .in("id", allocJobIds);
    for (const j of allocJobs ?? []) {
      allocJobMap.set(j.id, { job_number: j.job_number, job_name: j.job_name });
    }
  }

  const canCut =
    roll.roll_type === "parent" &&
    (roll.current_length_ft ?? 0) > 0 &&
    roll.status === "available";

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        href="/inventory/rolls"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Rolls
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight font-mono">
              {roll.tt_sku_tag_number ?? "—"}
            </h1>
            <RollStatusBadge status={roll.status} />
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-zinc-50 text-zinc-700 border-zinc-200 capitalize">
              {roll.roll_type}
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            {roll.product_name ?? "No product"}
            {roll.dye_lot && ` · Dye lot ${roll.dye_lot}`}
            {roll.manufacturer_roll_number && ` · Mfg ${roll.manufacturer_roll_number}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCut && (
            <Link
              href={`/inventory/cut?roll_id=${roll.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
            >
              <Scissors className="h-4 w-4" />
              Cut Roll
            </Link>
          )}
          <Link
            href={`/inventory/rolls/${roll.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>

      {/* Two column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Metadata */}
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100">
            <h2 className="text-sm font-semibold">Roll Information</h2>
          </div>
          <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
            <div>
              <dt className="text-xs text-zinc-400 mb-1">Vendor</dt>
              <dd className="text-zinc-800 font-medium">
                {vendor?.name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400 mb-1">Product</dt>
              <dd className="text-zinc-800 font-medium">
                {product?.name ?? roll.product_name ?? "—"}
                {product?.sku && (
                  <span className="block text-xs text-zinc-400 font-normal">
                    SKU: {product.sku}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400 mb-1">Width</dt>
              <dd className="text-zinc-800 font-medium">{fmtFt(roll.width_ft)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400 mb-1">Current Length</dt>
              <dd className="text-zinc-800 font-medium">
                {fmtFt(roll.current_length_ft)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400 mb-1">Original Length</dt>
              <dd className="text-zinc-800 font-medium">
                {fmtFt(roll.original_length_ft)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400 mb-1">Current Sq Ft</dt>
              <dd className="text-zinc-800 font-medium">
                {fmtSqFt(roll.width_ft, roll.current_length_ft)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400 mb-1">Dye Lot</dt>
              <dd className="text-zinc-800 font-medium">{roll.dye_lot ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400 mb-1">Location</dt>
              <dd className="text-zinc-800 font-medium">
                {location?.name ?? "—"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-zinc-400 mb-1">Created</dt>
              <dd className="text-zinc-700">
                {format(parseISO(roll.created_at), "MMM d, yyyy 'at' h:mm a")}
              </dd>
            </div>
            {roll.notes && (
              <div className="col-span-2">
                <dt className="text-xs text-zinc-400 mb-1">Notes</dt>
                <dd className="text-zinc-700 whitespace-pre-wrap">
                  {roll.notes}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Relationships */}
        <div className="space-y-6">
          {/* Allocated job */}
          {job && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100">
                <h2 className="text-sm font-semibold">Allocated Job</h2>
              </div>
              <div className="p-5">
                <Link
                  href={`/inventory/jobs/${job.id}`}
                  className="block hover:underline"
                >
                  <p className="font-medium text-zinc-900">
                    {job.job_name}
                    {job.job_number && (
                      <span className="text-zinc-400 ml-2">#{job.job_number}</span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5 capitalize">
                    {job.status}
                  </p>
                </Link>
              </div>
            </div>
          )}

          {/* Parent roll */}
          {parentRoll && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100">
                <h2 className="text-sm font-semibold">Parent Roll</h2>
              </div>
              <div className="p-5">
                <Link
                  href={`/inventory/rolls/${parentRoll.id}`}
                  className="block hover:underline"
                >
                  <p className="font-mono font-medium text-zinc-900">
                    {parentRoll.tt_sku_tag_number ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {parentRoll.product_name}
                    {parentRoll.dye_lot && ` · ${parentRoll.dye_lot}`}
                    {" · "}
                    Remaining: {fmtFt(parentRoll.current_length_ft)}
                  </p>
                  <div className="mt-2">
                    <RollStatusBadge status={parentRoll.status} />
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* Child rolls */}
          {roll.roll_type === "parent" && childRolls.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100">
                <h2 className="text-sm font-semibold">
                  Child Rolls ({childRolls.length})
                </h2>
              </div>
              <ul className="divide-y divide-zinc-100">
                {childRolls.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/inventory/rolls/${c.id}`}
                      className="block px-5 py-3 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono font-medium text-zinc-900 text-sm">
                            {c.tt_sku_tag_number ?? "—"}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {fmtFt(c.width_ft)} × {fmtFt(c.current_length_ft)}
                            {c.dye_lot && ` · ${c.dye_lot}`}
                          </p>
                        </div>
                        <RollStatusBadge status={c.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Allocations */}
          {allocations.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100">
                <h2 className="text-sm font-semibold">
                  Allocations ({allocations.length})
                </h2>
              </div>
              <ul className="divide-y divide-zinc-100">
                {allocations.map((a) => {
                  const j = allocJobMap.get(a.job_id);
                  return (
                    <li key={a.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/inventory/jobs/${a.job_id}`}
                          className="min-w-0 hover:underline"
                        >
                          <p className="text-sm font-medium text-zinc-900 truncate">
                            {j?.job_name ?? `Job ${a.job_id.slice(0, 8)}`}
                            {j?.job_number && (
                              <span className="text-zinc-400 ml-1">
                                #{j.job_number}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {a.requested_length_ft != null
                              ? fmtFt(a.requested_length_ft)
                              : "—"}{" "}
                            requested · {format(parseISO(a.created_at), "MMM d")}
                          </p>
                        </Link>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700 capitalize">
                          {a.status}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Transaction History</h2>
          <span className="text-xs text-zinc-400">
            {transactions.length} event{transactions.length === 1 ? "" : "s"}
          </span>
        </div>
        {transactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400">
            No transactions yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">
                  Type
                </th>
                <th className="px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide text-right">
                  Quantity
                </th>
                <th className="px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">
                  Notes
                </th>
                <th className="px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">
                  By
                </th>
                <th className="px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-zinc-50">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 capitalize">
                      {tx.transaction_type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 text-xs">
                    {tx.from_status && tx.to_status ? (
                      <>
                        <span className="capitalize">{tx.from_status}</span>{" "}
                        <span className="text-zinc-400">→</span>{" "}
                        <span className="capitalize">{tx.to_status}</span>
                      </>
                    ) : tx.to_status ? (
                      <span className="capitalize">{tx.to_status}</span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-700">
                    {tx.quantity_ft != null ? fmtFt(tx.quantity_ft) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 max-w-xs truncate">
                    {tx.notes ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 text-xs">
                    {tx.created_by ? (
                      actorMap.get(tx.created_by) ?? "—"
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs whitespace-nowrap">
                    {format(parseISO(tx.created_at), "MMM d, h:mm a")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
