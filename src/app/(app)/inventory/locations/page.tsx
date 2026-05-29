import { createClient } from "@/lib/supabase/server";
import { LocationForm } from "./location-form";
import { LocationRow } from "./location-row";
import type { InvLocation } from "@/lib/database.types";

export default async function InventoryLocationsPage() {
  const supabase = await createClient();

  const [locationsRes, rollsRes, itemsRes] = await Promise.all([
    supabase.from("inv_locations").select("*").order("name"),
    supabase.from("inv_rolls").select("location_id"),
    supabase.from("inv_items").select("location_id"),
  ]);

  const locations = (locationsRes.data ?? []) as InvLocation[];

  const rollCounts = new Map<string, number>();
  for (const r of rollsRes.data ?? []) {
    if (!r.location_id) continue;
    rollCounts.set(r.location_id, (rollCounts.get(r.location_id) ?? 0) + 1);
  }
  const itemCounts = new Map<string, number>();
  for (const i of itemsRes.data ?? []) {
    if (!i.location_id) continue;
    itemCounts.set(i.location_id, (itemCounts.get(i.location_id) ?? 0) + 1);
  }

  const active = locations.filter((l) => l.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {active} active · {locations.length} total
          </p>
        </div>
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold mb-4">Add Location</h2>
        <LocationForm mode="create" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {locations.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">
            No locations yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Rolls</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Items</th>
                <th className="text-center px-4 py-3 font-semibold text-zinc-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {locations.map((loc) => (
                <LocationRow
                  key={loc.id}
                  location={loc}
                  rollCount={rollCounts.get(loc.id) ?? 0}
                  itemCount={itemCounts.get(loc.id) ?? 0}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
