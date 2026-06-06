// Server-side read helpers for the warehouse module.
// All queries run with the service-role admin client; pages are server
// components so this is safe. Switch to RLS-aware client when Auth lands.

import { supabaseAdmin } from "@/lib/supabase/server";
import type {
  Asset,
  AssetKind,
  Budget,
  Delivery,
  Employee,
  Inspection,
  PullList,
  PullListRoll,
  ToolPurchase,
  VehicleMaintenance,
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
  let q = sb.from("warehouse_assets").select("*").order("name");
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Asset[];
}

export async function getAsset(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("warehouse_assets").select("*").eq("id", id).maybeSingle();
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

export async function listVehicleMaintenance(opts: { assetId?: string; limit?: number } = {}) {
  const sb = supabaseAdmin();
  let q = sb
    .from("warehouse_vehicle_maintenance")
    .select("*")
    .order("service_date", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.assetId) q = q.eq("asset_id", opts.assetId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as VehicleMaintenance[];
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
