import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RollStatusBadge } from "@/components/inventory/roll-status-badge";
import type {
  InvRoll,
  InvProduct,
  InvLocation,
} from "@/lib/db-helpers.types";

type Bucket = {
  id: string;
  label: string;
  min: number;
  max: number;
  color: string;
};

const BUCKETS: Bucket[] = [
  { id: "0-30",   label: "0–30 days",   min: 0,   max: 30,  color: "bg-brand-tint text-brand border-brand/30" },
  { id: "31-60",  label: "31–60 days",  min: 31,  max: 60,  color: "bg-brand-tint text-brand border-brand/30" },
  { id: "61-90",  label: "61–90 days",  min: 61,  max: 90,  color: "bg-warn-tint text-warn border-warn/30" },
  { id: "91-180", label: "91–180 days", min: 91,  max: 180, color: "bg-warn-tint text-warn border-warn/30" },
  { id: "180+",   label: "180+ days",   min: 181, max: Infinity, color: "bg-danger-tint text-danger border-danger/30" },
];

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function bucketFor(days: number): Bucket {
  return BUCKETS.find((b) => days >= b.min && days <= b.max) ?? BUCKETS[BUCKETS.length - 1];
}

export default async function AgingReportPage() {
  const supabase = await createClient();

  const { data: rollsRaw } = await supabase
    .from("inv_rolls")
    .select("*")
    .eq("status", "available")
    .order("created_at", { ascending: true });

  const rolls = (rollsRaw ?? []) as InvRoll[];

  // Hydrate product + location lookups
  const productIds = [...new Set(rolls.map((r) => r.product_id).filter(Boolean) as string[])];
  const locationIds = [...new Set(rolls.map((r) => r.location_id).filter(Boolean) as string[])];

  const [productsRes, locationsRes] = await Promise.all([
    productIds.length > 0
      ? supabase.from("inv_products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [] }),
    locationIds.length > 0
      ? supabase.from("inv_locations").select("id, name").in("id", locationIds)
      : Promise.resolve({ data: [] }),
  ]);

  const productMap = new Map<string, string>();
  for (const p of (productsRes.data ?? []) as unknown as Pick<InvProduct, "id" | "name">[]) {
    productMap.set(p.id, p.name);
  }
  const locationMap = new Map<string, string>();
  for (const l of (locationsRes.data ?? []) as unknown as Pick<InvLocation, "id" | "name">[]) {
    locationMap.set(l.id, l.name);
  }

  // Bucket aggregations
  const bucketStats = BUCKETS.map((b) => ({
    ...b,
    count: 0,
    totalFt: 0,
  }));

  const rollsWithAge = rolls.map((r) => {
    const days = daysSince(r.created_at);
    const bucket = bucketFor(days);
    const stat = bucketStats.find((s) => s.id === bucket.id)!;
    stat.count += 1;
    stat.totalFt += r.current_length_ft ?? 0;
    return { roll: r, days, bucket };
  });

  // Old rolls table — 91+ days, oldest first
  const oldRolls = rollsWithAge.filter((r) => r.days >= 91).sort((a, b) => b.days - a.days);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Aging Report</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            Available rolls bucketed by days in stock. Older rolls should move first.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/api/inventory/reports/aging.csv"
            className="flex items-center gap-2 rounded-xl border border-line-strong bg-white px-4 py-2.5 text-sm font-semibold text-ink-2 hover:border-line-strong hover:text-ink"
          >
            Export CSV
          </Link>
        </div>
      </div>

      {/* Bucket stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {bucketStats.map((b) => (
          <div key={b.id} className={`rounded-xl border p-4 ${b.color}`}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">{b.label}</p>
            <p className="text-2xl font-semibold mt-1">{b.count}</p>
            <p className="text-xs mt-1">{Math.round(b.totalFt).toLocaleString()} ft</p>
          </div>
        ))}
      </div>

      {/* Old rolls table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Rolls sitting 91+ days
          </h2>
          <span className="text-xs text-ink-4">{oldRolls.length} roll{oldRolls.length !== 1 ? "s" : ""}</span>
        </div>
        {oldRolls.length === 0 ? (
          <div className="empty-state">
            <span className="medallion medallion-brand"><CheckCircle2 className="h-5 w-5" /></span>
            <p className="empty-state-title">No aging stock</p>
            <p className="empty-state-body">No rolls have been sitting 91+ days — inventory is moving.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-hover">
                  <th className="text-left px-4 py-3 font-semibold text-ink-2">TT SKU</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-2">Product</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink-2">Width</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink-2">Length</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-2">Location</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-2">Received</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink-2">Days</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {oldRolls.map(({ roll, days, bucket }) => (
                  <tr key={roll.id} className="hover:bg-hover">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/inventory/rolls/${roll.id}`}
                        className="text-ink hover:underline"
                      >
                        {roll.tt_sku_tag_number ?? roll.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {roll.product_id
                        ? productMap.get(roll.product_id) ?? roll.product_name ?? "—"
                        : roll.product_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2">
                      {roll.width_ft != null ? `${roll.width_ft} ft` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2">
                      {roll.current_length_ft != null
                        ? `${Math.round(roll.current_length_ft)} ft`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-3">
                      {roll.location_id ? locationMap.get(roll.location_id) ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-3 whitespace-nowrap">
                      {format(parseISO(roll.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${bucket.color}`}
                      >
                        {days} d
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RollStatusBadge status={roll.status} />
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
