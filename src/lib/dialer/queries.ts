import { createClient } from "@/lib/supabase/server";
import type { CallList, CallListItem } from "@/lib/db-helpers.types";
import { clientDisplayName, primaryPhone } from "@/lib/marketing/jobber-contacts";
import { normalizePhone, type DialCandidate } from "./types";

// Reads use the user-context SSR client so RLS applies (AGENTS.md §6).
// Lists are team-shared by design; owner_id only drives the "My lists" filter.

export type CallListWithProgress = CallList & {
  totalItems: number;
  calledItems: number;
  ownerName: string | null;
};

export async function getCallLists(): Promise<CallListWithProgress[]> {
  const sb = await createClient();
  const { data: lists } = await sb
    .from("call_lists")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  const rows = (lists ?? []) as CallList[];
  if (!rows.length) return [];

  const listIds = rows.map((l) => l.id);
  const ownerIds = [...new Set(rows.map((l) => l.owner_id))];
  const [{ data: items }, { data: owners }] = await Promise.all([
    sb.from("call_list_items").select("call_list_id, status").in("call_list_id", listIds),
    sb.from("profiles").select("id, full_name").in("id", ownerIds),
  ]);

  const total: Record<string, number> = {};
  const called: Record<string, number> = {};
  for (const it of (items ?? []) as { call_list_id: string; status: string }[]) {
    total[it.call_list_id] = (total[it.call_list_id] ?? 0) + 1;
    if (it.status !== "pending") called[it.call_list_id] = (called[it.call_list_id] ?? 0) + 1;
  }
  const ownerName: Record<string, string> = {};
  for (const o of (owners ?? []) as { id: string; full_name: string | null }[]) {
    if (o.full_name) ownerName[o.id] = o.full_name;
  }

  return rows.map((l) => ({
    ...l,
    totalItems: total[l.id] ?? 0,
    calledItems: called[l.id] ?? 0,
    ownerName: ownerName[l.owner_id] ?? null,
  }));
}

export async function getCallList(id: string): Promise<CallList | null> {
  const sb = await createClient();
  const { data } = await sb.from("call_lists").select("*").eq("id", id).maybeSingle();
  return (data ?? null) as CallList | null;
}

export async function getListItems(listId: string): Promise<CallListItem[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("call_list_items")
    .select("*")
    .eq("call_list_id", listId)
    .order("position", { ascending: true });
  return (data ?? []) as CallListItem[];
}

// ── List-builder candidate sources ──────────────────────────────────────────

/** Sales contacts with a phone, optionally narrowed by deal stage / segment /
 * source. Stage filtering goes through deals (a "lead" is a contact whose deal
 * sits at stage='lead' — there is no separate leads table). */
export async function getContactCandidates(filters: {
  stage?: string;
  segment?: string;
  source?: string;
}): Promise<DialCandidate[]> {
  const sb = await createClient();

  let contactIdsForStage: string[] | null = null;
  if (filters.stage) {
    const { data: deals } = await sb
      .from("deals")
      .select("sales_contact_id")
      .eq("stage", filters.stage)
      .not("sales_contact_id", "is", null);
    contactIdsForStage = [
      ...new Set(
        ((deals ?? []) as { sales_contact_id: string | null }[])
          .map((d) => d.sales_contact_id)
          .filter((id): id is string => !!id),
      ),
    ];
    if (!contactIdsForStage.length) return [];
  }

  let q = sb
    .from("sales_contacts")
    .select("id, name, company, phone, segment, source")
    .not("phone", "is", null)
    .order("name", { ascending: true })
    .limit(500);
  if (contactIdsForStage) q = q.in("id", contactIdsForStage);
  if (filters.segment) q = q.eq("segment", filters.segment);
  if (filters.source) q = q.eq("source", filters.source);

  const { data } = await q;
  return ((data ?? []) as {
    id: string; name: string; company: string | null; phone: string | null;
    segment: string | null; source: string | null;
  }[])
    .filter((c) => c.phone?.trim())
    .map((c) => ({
      targetType: "sales_contact" as const,
      targetId: c.id,
      name: c.name,
      phone: c.phone!.trim(),
      company: c.company,
      meta: [c.segment && `Seg ${c.segment}`, c.source].filter(Boolean).join(" · ") || null,
    }));
}

/** Jobber clients matching a name search (3,241 synced — search, don't list). */
export async function getJobberCandidates(search: string): Promise<DialCandidate[]> {
  const q = search.trim();
  if (q.length < 2) return [];
  const sb = await createClient();
  const like = `%${q}%`;
  const { data } = await sb
    .from("jobber_clients")
    .select("id, first_name, last_name, company_name, phones, balance_cents")
    .or(`first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like}`)
    .eq("is_archived", false)
    .limit(50);

  const out: DialCandidate[] = [];
  for (const c of (data ?? []) as {
    id: string; first_name: string | null; last_name: string | null;
    company_name: string | null; phones: unknown; balance_cents: number | null;
  }[]) {
    const phone = primaryPhone(c.phones);
    if (!phone) continue;
    out.push({
      targetType: "jobber_client",
      targetId: c.id,
      name: clientDisplayName(c),
      phone,
      company: c.company_name,
      meta: c.balance_cents ? `Balance $${(c.balance_cents / 100).toFixed(0)}` : "Jobber client",
    });
  }
  return out;
}

/** TurfCasa order customers, deduped by normalized phone (orders carry the
 * customer inline — no standalone customer table). target_id = phone digits. */
export async function getTurfcasaCandidates(): Promise<DialCandidate[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("turfcasa_orders")
    .select("customer_name, customer_phone, company, is_trade, created_at")
    .not("customer_phone", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  const byPhone = new Map<string, DialCandidate & { orders: number }>();
  for (const o of (data ?? []) as {
    customer_name: string; customer_phone: string | null;
    company: string | null; is_trade: boolean; created_at: string;
  }[]) {
    const raw = o.customer_phone?.trim();
    if (!raw) continue;
    const key = normalizePhone(raw);
    if (key.length < 7) continue;
    const existing = byPhone.get(key);
    if (existing) {
      existing.orders += 1;
      existing.meta = candidateMeta(existing.orders, o.is_trade);
    } else {
      byPhone.set(key, {
        targetType: "turfcasa_customer",
        targetId: key,
        name: o.customer_name,
        phone: raw,
        company: o.company,
        meta: candidateMeta(1, o.is_trade),
        orders: 1,
      });
    }
  }
  return [...byPhone.values()].map(({ orders: _orders, ...c }) => c);
}

function candidateMeta(orders: number, isTrade: boolean): string {
  const label = orders === 1 ? "1 order" : `${orders} orders`;
  return isTrade ? `${label} · trade` : label;
}
