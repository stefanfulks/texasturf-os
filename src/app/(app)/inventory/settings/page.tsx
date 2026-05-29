import { createClient } from "@/lib/supabase/server";
import { loadInventorySettings } from "@/lib/inventory/settings";
import { SettingsForm } from "./settings-form";
import type { InvLocation } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function InventorySettingsPage() {
  const supabase = await createClient();

  const [settings, locationsRes] = await Promise.all([
    loadInventorySettings(),
    supabase.from("inv_locations").select("*").eq("active", true).order("name"),
  ]);

  const locations = (locationsRes.data ?? []) as unknown as InvLocation[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Module-wide settings stored in the <code className="text-xs px-1.5 py-0.5 bg-zinc-100 rounded">inv_settings</code> table.
        </p>
      </div>

      <SettingsForm settings={settings} locations={locations} />
    </div>
  );
}
