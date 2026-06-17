import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { SectionId } from "./schemas";

export type KpiSection = Database["public"]["Tables"]["kpi_log_sections"]["Row"];
export type KpiEntry   = Database["public"]["Tables"]["kpi_log_entries"]["Row"];

export type KpiTarget = { label: string; value: string };

export async function listSections(): Promise<KpiSection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_log_sections")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listEntries(opts: {
  sectionId: SectionId;
  pendingOnly?: boolean;
  limit?: number;
}): Promise<KpiEntry[]> {
  const supabase = await createClient();
  let q = supabase
    .from("kpi_log_entries")
    .select("*")
    .eq("section_id", opts.sectionId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.pendingOnly) q = q.is("mgmt_signed_by", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function countPending(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("kpi_log_entries")
    .select("*", { count: "exact", head: true })
    .is("mgmt_signed_by", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getEntry(id: string): Promise<KpiEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_log_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Resolve signer display names so the table can show "Signed by Stefan" instead
// of a bare uuid. Single-batch lookup; null if nothing to look up.
export async function resolveSignerNames(
  ids: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);
  if (error) throw new Error(error.message);
  const out = new Map<string, string>();
  for (const p of data ?? []) {
    out.set(p.id, p.full_name ?? "Unknown");
  }
  return out;
}
