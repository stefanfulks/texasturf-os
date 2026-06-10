import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RollForm } from "../../new/roll-form";
import type {
  InvRoll,
  InvLocation,
  InvProduct,
  Vendor,
} from "@/lib/db-helpers.types";

export default async function EditRollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [rollRes, locationsRes, productsRes, vendorsRes] = await Promise.all([
    supabase.from("inv_rolls").select("*").eq("id", id).single(),
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

  if (!rollRes.data) notFound();
  const roll = rollRes.data as InvRoll;
  const locations = (locationsRes.data ?? []) as Pick<InvLocation, "id" | "name">[];
  const products = (productsRes.data ?? []) as Pick<InvProduct, "id" | "name">[];
  const vendors = (vendorsRes.data ?? []) as Pick<Vendor, "id" | "name">[];

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/inventory/rolls/${roll.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Roll {roll.tt_sku_tag_number ?? ""}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Roll</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Update roll details. Status changes are logged as transactions.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <RollForm
          mode="edit"
          roll={roll}
          locations={locations}
          products={products}
          vendors={vendors}
        />
      </div>
    </div>
  );
}
