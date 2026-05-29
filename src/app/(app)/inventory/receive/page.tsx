import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReceiveForm } from "./receive-form";
import { loadInventorySettings } from "@/lib/inventory/settings";
import type { Vendor, InvProduct, InvLocation } from "@/lib/database.types";

export default async function InventoryReceivePage() {
  const supabase = await createClient();
  const settings = await loadInventorySettings();

  const [vendorsResult, productsResult, locationsResult, pendingCountResult] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, name")
      .eq("active", true)
      .order("name"),
    supabase
      .from("inv_products")
      .select("id, name, sku, width_ft")
      .eq("active", true)
      .order("name"),
    supabase
      .from("inv_locations")
      .select("id, name")
      .eq("active", true)
      .order("name"),
    supabase
      .from("inv_rolls")
      .select("id", { count: "exact", head: true })
      .eq("status", "planned"),
  ]);

  const vendors = (vendorsResult.data ?? []) as unknown as Pick<Vendor, "id" | "name">[];
  const products = (productsResult.data ?? []) as unknown as Pick<
    InvProduct,
    "id" | "name" | "sku" | "width_ft"
  >[];
  const locations = (locationsResult.data ?? []) as unknown as Pick<InvLocation, "id" | "name">[];
  const pendingCount = pendingCountResult.count ?? 0;

  // Default location: prefer the configured setting; fall back to any
  // location whose name contains "receiv" (legacy behavior).
  const configuredLocation = settings.default_receiving_location_id
    ? locations.find((l) => l.id === settings.default_receiving_location_id)
    : undefined;
  const receivingLocation =
    configuredLocation ?? locations.find((l) => /receiv/i.test(l.name));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Receive Inventory</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Add new rolls to TexasTurf warehouse inventory.
          </p>
        </div>
        <Link
          href="/inventory/receive/pending"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <ClipboardList className="w-4 h-4" aria-hidden="true" />
          Pending
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
              {pendingCount}
            </span>
          )}
        </Link>
      </div>

      <ReceiveForm
        vendors={vendors}
        products={products}
        locations={locations}
        defaultLocationId={receivingLocation?.id ?? ""}
      />
    </div>
  );
}
