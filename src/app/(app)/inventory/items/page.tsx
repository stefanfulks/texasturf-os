import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "./item-form";
import { ItemRow } from "./item-row";
import type { InvItem, InvLocation } from "@/lib/database.types";

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
          <h1 className="text-2xl font-semibold tracking-tight">Other Inventory</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Consumables, fasteners, infill, accessories
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Total Items</p>
          <p className="text-2xl font-semibold text-zinc-900">{allItems.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Active</p>
          <p className="text-2xl font-semibold text-zinc-900">
            {allItems.filter((i) => i.active).length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Low Stock</p>
          <p className={`text-2xl font-semibold ${lowStockCount > 0 ? "text-red-700" : "text-zinc-400"}`}>
            {lowStockCount}
          </p>
        </div>
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
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
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            All
          </Link>
          <Link
            href={`/inventory/items?low=1${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              lowOnly
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
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
            className="w-full text-sm border border-zinc-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
          />
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">
            {lowOnly ? "No low-stock items." : "No items yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">SKU</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Qty</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Unit</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Min</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Location</th>
                <th className="text-center px-4 py-3 font-semibold text-zinc-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
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
