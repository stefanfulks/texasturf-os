import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CutRollForm } from "./cut-roll-form";
import { redirectIfNotOfficeOrAdmin } from "../_lib/require-role";
import type { InvRoll } from "@/lib/db-helpers.types";

type ParentRollOption = Pick<
  InvRoll,
  | "id"
  | "tt_sku_tag_number"
  | "product_name"
  | "dye_lot"
  | "width_ft"
  | "current_length_ft"
  | "status"
>;

export default async function InventoryCutPage({
  searchParams,
}: {
  searchParams: Promise<{ roll_id?: string }>;
}) {
  await redirectIfNotOfficeOrAdmin();
  const { roll_id } = await searchParams;
  const supabase = await createClient();

  const { data: rollsRaw } = await supabase
    .from("inv_rolls")
    .select(
      "id, tt_sku_tag_number, product_name, dye_lot, width_ft, current_length_ft, status",
    )
    .eq("roll_type", "parent")
    .eq("status", "available")
    .gt("current_length_ft", 0)
    .order("tt_sku_tag_number");

  const parentRolls = (rollsRaw ?? []) as ParentRollOption[];

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/inventory/rolls"
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
      >
        ← Rolls
      </Link>

      <div>
        <h1 className="page-title">Cut Roll</h1>
        <p className="text-sm text-ink-3 mt-0.5">
          Cut a length from a parent roll to create a child roll.
        </p>
      </div>

      <div className="card p-6">
        <CutRollForm
          parentRolls={parentRolls}
          initialRollId={roll_id ?? ""}
        />
      </div>
    </div>
  );
}
