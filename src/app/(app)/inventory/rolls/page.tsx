import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { RollStatusBadge } from "@/components/inventory/roll-status-badge";
import { RollFilterBar } from "./roll-filter-bar";
import type {
  InvRoll,
  InvLocation,
  InvProduct,
  RollStatus,
} from "@/lib/db-helpers.types";

const ROLL_STATUSES: RollStatus[] = [
  "available",
  "planned",
  "allocated",
  "staged",
  "dispatched",
  "consumed",
  "damaged",
  "returned",
];

function fmtFt(n: number | null) {
  if (n == null) return "—";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} ft`;
}

function relativeTime(iso: string) {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

type RollRow = Pick<
  InvRoll,
  | "id"
  | "tt_sku_tag_number"
  | "manufacturer_roll_number"
  | "product_name"
  | "product_id"
  | "dye_lot"
  | "width_ft"
  | "current_length_ft"
  | "original_length_ft"
  | "status"
  | "roll_type"
  | "location_id"
  | "updated_at"
>;

export default async function InventoryRollsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    location_id?: string;
    product_id?: string;
    search?: string;
  }>;
}) {
  const { status, location_id, product_id, search } = await searchParams;
  const supabase = await createClient();

  // Filter dropdown data + rolls in parallel
  const [locationsRes, productsRes] = await Promise.all([
    supabase
      .from("inv_locations")
      .select("id, name")
      .eq("active", true)
      .order("name"),
    supabase
      .from("inv_products")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  const locations = (locationsRes.data ?? []) as Pick<InvLocation, "id" | "name">[];
  const products = (productsRes.data ?? []) as Pick<InvProduct, "id" | "name">[];

  let query = supabase
    .from("inv_rolls")
    .select(
      "id, tt_sku_tag_number, manufacturer_roll_number, product_name, product_id, dye_lot, width_ft, current_length_ft, original_length_ft, status, roll_type, location_id, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (status && ROLL_STATUSES.includes(status as RollStatus)) {
    query = query.eq("status", status as RollStatus);
  }
  if (location_id) {
    query = query.eq("location_id", location_id);
  }
  if (product_id) {
    query = query.eq("product_id", product_id);
  }
  if (search && search.trim()) {
    const q = search.trim();
    const escaped = q.replace(/[,()]/g, "");

    // Broaden the search: also match by product SKU and location name.
    // SKU lives on inv_products, location name on inv_locations — pre-resolve
    // matching ids so we can include them in a single OR clause on rolls.
    const [productMatch, locationMatch] = await Promise.all([
      supabase
        .from("inv_products")
        .select("id")
        .or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%`),
      supabase
        .from("inv_locations")
        .select("id")
        .ilike("name", `%${escaped}%`),
    ]);
    const productIds  = (productMatch.data  ?? []).map((p) => p.id);
    const locationIds = (locationMatch.data ?? []).map((l) => l.id);

    const orClauses = [
      `tt_sku_tag_number.ilike.%${escaped}%`,
      `manufacturer_roll_number.ilike.%${escaped}%`,
      `product_name.ilike.%${escaped}%`,
      `dye_lot.ilike.%${escaped}%`,
      `notes.ilike.%${escaped}%`,
    ];
    if (productIds.length > 0)  orClauses.push(`product_id.in.(${productIds.join(",")})`);
    if (locationIds.length > 0) orClauses.push(`location_id.in.(${locationIds.join(",")})`);

    query = query.or(orClauses.join(","));
  }

  const { data: rollsRaw } = await query;
  const rolls = (rollsRaw ?? []) as RollRow[];

  const locationMap = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rolls</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            {rolls.length} roll{rolls.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/inventory/rolls/new"
          className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink transition-colors"
        >
          <span className="text-lg leading-none">+</span> New Roll
        </Link>
      </div>

      {/* Filters */}
      <RollFilterBar
        locations={locations}
        products={products}
        initialStatus={status ?? ""}
        initialLocationId={location_id ?? ""}
        initialProductId={product_id ?? ""}
        initialSearch={search ?? ""}
      />

      {/* Table */}
      <div className="rounded-xl border border-line bg-white overflow-hidden">
        {rolls.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-4">
            No rolls found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-hover text-left">
                  <th className="px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">
                    TT SKU
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">
                    Mfg #
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">
                    Product
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">
                    Dye Lot
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide text-right">
                    Width
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide text-right">
                    Length
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">
                    Location
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {rolls.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-line hover:bg-hover/60 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/inventory/rolls/${r.id}`}
                        className="font-mono font-medium text-ink hover:underline"
                      >
                        {r.tt_sku_tag_number ?? "—"}
                      </Link>
                      {r.roll_type === "child" && (
                        <span className="ml-2 text-[10px] uppercase font-semibold text-ink-4">
                          child
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">
                      {r.manufacturer_roll_number ?? (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">
                      {r.product_name ?? (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">
                      {r.dye_lot ?? <span className="text-ink-4">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-2">
                      {fmtFt(r.width_ft)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-2">
                      <span className="font-medium">
                        {fmtFt(r.current_length_ft)}
                      </span>
                      {r.original_length_ft != null && (
                        <span className="text-ink-4">
                          {" "}
                          / {fmtFt(r.original_length_ft)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <RollStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">
                      {r.location_id ? (
                        locationMap.get(r.location_id) ?? "—"
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-4 whitespace-nowrap">
                      {relativeTime(r.updated_at)}
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
