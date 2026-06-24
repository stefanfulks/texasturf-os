import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { PurchaseOrder, PurchaseOrderEvent } from "@/lib/db-helpers.types";
import { createServiceClient } from "@/lib/supabase/service";

type DB = SupabaseClient<Database>;

export type ProfileLite = { id: string; full_name: string | null; email: string; role: string };
export type VendorLite  = { id: string; name: string };
export type ProjectLite = { id: string; name: string };

export type OrderLookups = {
  profiles: ProfileLite[];
  vendors:  VendorLite[];
  projects: ProjectLite[];
};

/** Reference data for the create/edit forms (buyers, vendors, jobs). */
export async function getLookups(supabase: DB): Promise<OrderLookups> {
  const [profilesRes, vendorsRes, projectsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role").order("full_name"),
    supabase.from("vendors").select("id, name").eq("active", true).order("name"),
    supabase.from("projects").select("id, name").order("name"),
  ]);
  return {
    profiles: (profilesRes.data ?? []) as ProfileLite[],
    vendors:  (vendorsRes.data ?? []) as VendorLite[],
    projects: (projectsRes.data ?? []) as ProjectLite[],
  };
}

/** All purchase orders, newest first. RLS lets every authenticated user read. */
export async function listOrders(supabase: DB): Promise<PurchaseOrder[]> {
  const { data } = await supabase
    .from("purchase_orders")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as PurchaseOrder[];
}

/** Single order plus its event history (newest first). */
export async function getOrderWithEvents(
  supabase: DB,
  id: string,
): Promise<{ order: PurchaseOrder | null; events: PurchaseOrderEvent[] }> {
  const [orderRes, eventsRes] = await Promise.all([
    supabase.from("purchase_orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("purchase_order_events")
      .select("*")
      .eq("purchase_order_id", id)
      .order("created_at", { ascending: false }),
  ]);
  return {
    order:  (orderRes.data as PurchaseOrder | null) ?? null,
    events: (eventsRes.data ?? []) as PurchaseOrderEvent[],
  };
}

/** Sign document paths in the private `purchase-orders` bucket → view URLs. */
export async function signPoDocs(paths: string[], expiresIn = 60 * 60): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return map;
  try {
    const service = createServiceClient();
    const { data } = await service.storage.from("purchase-orders").createSignedUrls(unique, expiresIn);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
    }
  } catch {
    // service key not configured locally — skip signing, list filenames only
  }
  return map;
}

/** Name lookup maps for rendering related fields without per-row joins. */
export function nameMaps(lookups: OrderLookups) {
  const profile = new Map(lookups.profiles.map((p) => [p.id, p.full_name || p.email]));
  const vendor  = new Map(lookups.vendors.map((v) => [v.id, v.name]));
  const project = new Map(lookups.projects.map((p) => [p.id, p.name]));
  return { profile, vendor, project };
}
