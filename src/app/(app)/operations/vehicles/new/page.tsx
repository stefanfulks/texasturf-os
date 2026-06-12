import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listVehicleAssets } from "@/lib/warehouse/queries";
import { NewMaintenanceForm } from "./new-maintenance-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log service · TexasTurf OS" };

export default async function NewMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { asset: prefillAssetId } = await searchParams;
  const assets = await listVehicleAssets();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Log service</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          Records a maintenance event against a vehicle. Optionally links to a
          scheduled service so &quot;last serviced&quot; advances.
        </p>
      </div>
      <NewMaintenanceForm assets={assets} prefillAssetId={prefillAssetId ?? null} />
    </div>
  );
}
