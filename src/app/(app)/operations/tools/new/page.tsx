import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listAssetsForToolPurchase,
  listEmployees,
} from "@/lib/warehouse/queries";
import { NewToolPurchaseForm } from "./new-tool-purchase-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log purchase · TexasTurf OS" };

export default async function NewToolPurchasePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [assets, employees] = await Promise.all([
    listAssetsForToolPurchase(),
    listEmployees({ activeOnly: true }),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="page-title">Log purchase</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          Quick field-log of a tool, small-equipment, or supply purchase.
        </p>
      </div>
      <NewToolPurchaseForm
        assets={assets}
        employees={employees.map((e) => ({ id: e.id, display_name: e.display_name }))}
      />
    </div>
  );
}
