import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadInventorySettings } from "@/lib/inventory/settings";
import { SettingsForm } from "./settings-form";
import { redirectIfNotOfficeOrAdmin } from "../_lib/require-role";
import type { InvLocation } from "@/lib/db-helpers.types";

export const dynamic = "force-dynamic";

export default async function InventorySettingsPage() {
  await redirectIfNotOfficeOrAdmin();
  const supabase = await createClient();

  const [settings, locationsRes] = await Promise.all([
    loadInventorySettings(),
    supabase.from("inv_locations").select("*").eq("active", true).order("name"),
  ]);

  const locations = (locationsRes.data ?? []) as unknown as InvLocation[];

  return (
    <div className="space-y-6">
      <Link href="/inventory" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        ← Inventory
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory Settings</h1>
        <p className="text-sm text-ink-3 mt-0.5">
          Module-wide settings stored in the <code className="text-xs px-1.5 py-0.5 bg-sunken rounded">inv_settings</code> table.
        </p>
      </div>

      <SettingsForm settings={settings} locations={locations} />
    </div>
  );
}
