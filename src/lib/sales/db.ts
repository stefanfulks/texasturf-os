import { createClient } from '@/lib/supabase/server';

// Typed facade over the sales tables. Wraps the user-context Supabase client
// (so RLS applies, AGENTS.md §6) and types exactly the query surface we use,
// returning rows as `unknown` for casting to the precise hand types in
// src/lib/sales/types.ts. We keep this rather than the generated row types so
// the jsonb `stage_tasks` column carries its real Partial<Record<Stage,...>>
// shape instead of the generator's opaque `Json`. Zero `any`.

type Result = { data: unknown; error: unknown };

interface SalesQuery extends PromiseLike<Result> {
  select(cols?: string): SalesQuery;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): SalesQuery;
  update(values: Record<string, unknown>): SalesQuery;
  eq(column: string, value: unknown): SalesQuery;
  in(column: string, values: readonly unknown[]): SalesQuery;
  ilike(column: string, pattern: string): SalesQuery;
  not(column: string, op: string, value: string): SalesQuery;
  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): SalesQuery;
  limit(n: number): SalesQuery;
  maybeSingle(): PromiseLike<Result>;
  single(): PromiseLike<Result>;
}

type SalesTable = 'deals' | 'sales_contacts' | 'deal_activities' | 'jobber_clients';

interface SalesDbClient {
  from(table: SalesTable): SalesQuery;
}

/** User-context client, typed for the sales tables (RLS applies). */
export async function salesDb(): Promise<SalesDbClient> {
  return (await createClient()) as unknown as SalesDbClient;
}
