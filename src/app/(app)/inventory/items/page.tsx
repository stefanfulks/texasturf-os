import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "./item-form";
import { ItemRow } from "./item-row";
import type { InvItem, InvLocation } from "@/lib/db-helpers.types";

export default async function InventoryItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ low?: string; q?: string }>;
}) {
  const { low, q } = await searchParams;
  const lowOnly = low === "1";

  const supabase = await createClient();

  const [itemsRes, locationsRes] = await Promise.all([
    supabase.from("inv_items").select("*").order("name"),
    supabase.from("inv_locations").select("id, name").eq("active", true).order("name"),
  ]);

  const allItems = (itemsRes.data ?? []) as InvItem[];
  const locations = (locationsRes.data ?? []) as Pick<InvLocation, "id" | "name">[];

  const locationMap = new Map<string, string>();
  for (const l of locations) locationMap.set(l.id, l.name);

  const isLow = (it: InvItem) => it.min_quantity > 0 && it.quantity <= it.min_quantity;
  const lowStockCount = allItems.filter((i) => i.active && isLow(i)).length;

  let items = allItems;
  if (lowOnly) items = items.filter(isLow);
  if (q) {
    const needle = q.toLowerCase();
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(needle) ||
        (i.sku ?? "").toLowerCase().includes(needle),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Other Inventory</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            Consumables, fasteners, infill, accessories
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Total Items</p>
          <p className="text-2xl font-semibold text-ink">{allItems.length}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Active</p>
          <p className="text-2xl font-semibold text-ink">
            {allItems.filter((i) => i.active).length}
          </p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Low Stock</p>
          <p className={`text-2xl font-semibold ${lowStockCount > 0 ? "text-danger" : "text-ink-4"}`}>
            {lowStockCount}
          </p>
        </div>
      </div>

      {/* Add form */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold mb-4">Add Item</h2>
        <ItemForm mode="create" locations={locations} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5">
          <Link
            href={`/inventory/items${q ? `?q=${encodeURIComponent(q)}` : ""}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              !lowOnly
                ? "border-brand-strong bg-brand text-on-brand"
                : "bg-white text-ink-2 border-line hover:border-line-strong"
            }`}
          >
            All
          </Link>
          <Link
            href={`/inventory/items?low=1${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              lowOnly
                ? "border-brand-strong bg-brand text-on-brand"
                : "bg-white text-ink-2 border-line hover:border-line-strong"
            }`}
          >
            Low Stock Only {lowStockCount > 0 && `(${lowStockCount})`}
          </Link>
        </div>

        <form method="GET" className="flex-1 max-w-sm">
          {lowOnly && <input type="hidden" name="low" value="1" />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search items…"
            className="field-input"
          />
        </form>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-4">
            {lowOnly ? "No low-stock items." : "No items yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-hover">
                <th className="text-left px-4 py-3 font-semibold text-ink-2">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-ink-2">SKU</th>
                <th className="text-right px-4 py-3 font-semibold text-ink-2">Qty</th>
                <th className="text-left px-4 py-3 font-semibold text-ink-2">Unit</th>
                <th className="text-right px-4 py-3 font-semibold text-ink-2">Min</th>
                <th className="text-left px-4 py-3 font-semibold text-ink-2">Location</th>
                <th className="text-center px-4 py-3 font-semibold text-ink-2">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-ink-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  locations={locations}
                  locationName={it.location_id ? locationMap.get(it.location_id) ?? null : null}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
