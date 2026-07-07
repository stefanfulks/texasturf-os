import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RollForm } from "./roll-form";
import { redirectIfNotOfficeOrAdmin } from "../../_lib/require-role";
import type { InvLocation, InvProduct, Vendor } from "@/lib/db-helpers.types";

export default async function NewRollPage() {
  await redirectIfNotOfficeOrAdmin();
  const supabase = await createClient();

  const [locationsRes, productsRes, vendorsRes] = await Promise.all([
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
    supabase
      .from("vendors")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  const locations = (locationsRes.data ?? []) as Pick<InvLocation, "id" | "name">[];
  const products = (productsRes.data ?? []) as Pick<InvProduct, "id" | "name">[];
  const vendors = (vendorsRes.data ?? []) as Pick<Vendor, "id" | "name">[];

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/inventory/rolls"
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
      >
        ← Rolls
      </Link>

      <div>
        <h1 className="page-title">New Roll</h1>
        <p className="text-sm text-ink-3 mt-0.5">
          Add a new parent roll to inventory.
        </p>
      </div>

      <div className="card p-6">
        <RollForm
          mode="create"
          locations={locations}
          products={products}
          vendors={vendors}
        />
      </div>
    </div>
  );
}
