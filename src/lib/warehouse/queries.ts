// Server-side read helpers for the warehouse / operations module.
//
// Reconciled with the existing OS schema:
//   - Asset rows come from public.assets (extended in B1 with make/model/year);
//     unit_type is the kind selector (truck/trailer/heavy_equipment/tool).
//   - Maintenance rows come from public.maintenance_logs (not from a
//     warehouse-specific table).
//
// All queries run with the service-role admin client; pages are server
// components so this is safe. Switch to RLS-aware client when these reads
// move to a route handler.

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  Asset,
  AssetKind,
  Budget,
  Delivery,
  Employee,
  Inspection,
  MaintenanceLog,
  PullList,
  PullListRoll,
  ToolPurchase,
} from "./types";

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export async function listEmployees(opts: { activeOnly?: boolean } = {}) {
  const sb = supabaseAdmin();
  let q = sb.from("warehouse_employees").select("*").order("display_name");
  if (opts.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Employee[];
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export async function listAssets(opts: { kind?: AssetKind; activeOnly?: boolean } = {}) {
  const sb = supabaseAdmin();
  let q = sb
    .from("assets")
    .select("id, name, unit_type, identifier, make, model, year, notes, status, created_at, updated_at")
    .order("name");
  if (opts.kind) q = q.eq("unit_type", opts.kind);
  // OS assets has no is_active flag — "out_of_service" is the dead state.
  if (opts.activeOnly) q = q.neq("status", "out_of_service");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Asset[];
}

export async function getAsset(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("assets")
    .select("id, name, unit_type, identifier, make, model, year, notes, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Asset | null;
}

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

export async function listInspections(opts: { limit?: number } = {}) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_inspections")
    .select("*")
    .order("inspected_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (error) throw new Error(error.message);
  return (data ?? []) as Inspection[];
}

export async function getInspection(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_inspections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Inspection | null;
}

// ---------------------------------------------------------------------------
// Pull lists
// ---------------------------------------------------------------------------

export async function listPullLists(opts: { limit?: number } = {}) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_pull_lists")
    .select("*")
    .order("job_date", { ascending: false })
    .limit(opts.limit ?? 50);
  if (error) throw new Error(error.message);
  return (data ?? []) as PullList[];
}

export async function getPullList(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_pull_lists")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as PullList | null;
}

export async function getPullListRolls(pullListId: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_pull_list_rolls")
    .select("*")
    .eq("pull_list_id", pullListId)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as PullListRoll[];
}

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

export async function listDeliveries(opts: { limit?: number } = {}) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_deliveries")
    .select("*")
    .order("delivered_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (error) throw new Error(error.message);
  return (data ?? []) as Delivery[];
}

export async function getDelivery(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_deliveries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Delivery | null;
}

// ---------------------------------------------------------------------------
// Vehicle maintenance + budgets
// ---------------------------------------------------------------------------

/**
 * Vehicle maintenance log entries (powered by the existing maintenance_logs
 * table — has schedule FK and meter tracking that the variant didn't).
 */
export async function listMaintenanceLogs(opts: { assetId?: string; limit?: number } = {}) {
  const sb = supabaseAdmin();
  let q = sb
    .from("maintenance_logs")
    .select(
      "id, asset_id, schedule_id, performed_at, description, cost_cents, meter_value, " +
      "performed_by_profile, performed_by_vendor, vendor, invoice_url, notes, created_at",
    )
    .order("performed_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.assetId) q = q.eq("asset_id", opts.assetId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  // database.types.ts doesn't yet reflect the vendor / invoice_url columns
  // added in B1; cast through unknown until types are regenerated.
  return (data ?? []) as unknown as MaintenanceLog[];
}

export async function listToolPurchases(opts: { limit?: number } = {}) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_tool_purchases")
    .select("*")
    .order("purchase_date", { ascending: false })
    .limit(opts.limit ?? 100);
  if (error) throw new Error(error.message);
  return (data ?? []) as ToolPurchase[];
}

export async function listBudgets(opts: { kind?: "vehicle_maintenance" | "tool_purchases" } = {}) {
  const sb = supabaseAdmin();
  let q = sb.from("warehouse_budgets").select("*").order("period_start", { ascending: false });
  if (opts.kind) q = q.eq("kind", opts.kind);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Budget[];
}

// ---------------------------------------------------------------------------
// Dashboard counts for the module landing page
// ---------------------------------------------------------------------------

export async function warehouseDashboardCounts() {
  const sb = supabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);

  const [pullsToday, inspectionsToday, deliveriesToday, openPulls] = await Promise.all([
    sb.from("warehouse_pull_lists").select("*", { count: "exact", head: true }).eq("job_date", todayIso),
    sb
      .from("warehouse_inspections")
      .select("*", { count: "exact", head: true })
      .gte("inspected_at", today.toISOString()),
    sb
      .from("warehouse_deliveries")
      .select("*", { count: "exact", head: true })
      .gte("delivered_at", today.toISOString()),
    sb
      .from("warehouse_pull_lists")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "pulled", "staged"]),
  ]);

  return {
    pullsToday: pullsToday.count ?? 0,
    inspectionsToday: inspectionsToday.count ?? 0,
    deliveriesToday: deliveriesToday.count ?? 0,
    openPulls: openPulls.count ?? 0,
  };
}
