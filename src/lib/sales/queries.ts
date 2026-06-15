import { salesDb } from './db';
import type { Deal, SalesContact, DealActivity } from './types';

// Reads use the user-context SSR client (via the typed sales shim), so RLS
// applies (AGENTS.md §6). Swap `salesDb()` → `createClient()` after typegen.

export async function getOpenDeals(): Promise<Deal[]> {
  const sb = await salesDb();
  const { data } = await sb
    .from('deals')
    .select('*')
    .not('stage', 'in', '("closed_won","closed_lost")')
    .order('value_usd', { ascending: false, nullsFirst: false });
  return (data ?? []) as Deal[];
}

export async function getAllDeals(): Promise<Deal[]> {
  const sb = await salesDb();
  const { data } = await sb.from('deals').select('*');
  return (data ?? []) as Deal[];
}

export async function getDeal(id: string): Promise<Deal | null> {
  const sb = await salesDb();
  const { data } = await sb.from('deals').select('*').eq('id', id).maybeSingle();
  return (data ?? null) as Deal | null;
}

export async function getDealActivities(dealId: string): Promise<DealActivity[]> {
  const sb = await salesDb();
  const { data } = await sb
    .from('deal_activities')
    .select('*')
    .eq('deal_id', dealId)
    .order('occurred_at', { ascending: false });
  return (data ?? []) as DealActivity[];
}

/**
 * Most-recent activity timestamp per deal, for per-card health on the board.
 * One query over all the board's deals; reduced to max(occurred_at) per deal.
 */
export async function getLastActivityMap(
  dealIds: string[],
): Promise<Record<string, string>> {
  if (!dealIds.length) return {};
  const sb = await salesDb();
  const { data } = await sb
    .from('deal_activities')
    .select('deal_id, occurred_at')
    .in('deal_id', dealIds);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { deal_id: string; occurred_at: string }[]) {
    if (!map[row.deal_id] || row.occurred_at > map[row.deal_id]) {
      map[row.deal_id] = row.occurred_at;
    }
  }
  return map;
}

export async function getContact(id: string): Promise<SalesContact | null> {
  const sb = await salesDb();
  const { data } = await sb.from('sales_contacts').select('*').eq('id', id).maybeSingle();
  return (data ?? null) as SalesContact | null;
}

export async function getContactsByIds(ids: string[]): Promise<SalesContact[]> {
  if (!ids.length) return [];
  const sb = await salesDb();
  const { data } = await sb.from('sales_contacts').select('*').in('id', ids);
  return (data ?? []) as SalesContact[];
}

export async function searchJobberClients(q: string): Promise<{ id: string; name: string }[]> {
  const sb = await salesDb();
  const { data } = await sb
    .from('jobber_clients')
    .select('id, name')
    .ilike('name', `%${q}%`)
    .limit(10);
  return (data ?? []) as { id: string; name: string }[];
}

export async function getJobberClientNames(
  ids: string[],
): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const sb = await salesDb();
  const { data } = await sb.from('jobber_clients').select('id, name').in('id', ids);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { id: string; name: string }[]) map[row.id] = row.name;
  return map;
}
