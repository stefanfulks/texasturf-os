-- Finance QuickBooks seam. Additive. Admin-only RLS (matches the fin_ suite).

alter table public.fin_ar_invoice add column if not exists external_id text;
alter table public.fin_ap_bill   add column if not exists external_id text;
create unique index if not exists fin_ar_invoice_external_idx on public.fin_ar_invoice (external_id) where external_id is not null;
create unique index if not exists fin_ap_bill_external_idx   on public.fin_ap_bill   (external_id) where external_id is not null;

create table if not exists public.fin_qb_account_map (
  id              uuid primary key default gen_random_uuid(),
  qb_account_id   text,
  qb_account_name text not null,
  fin_account_id  text not null references public.fin_account(id) on delete cascade,
  active          boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (qb_account_id)
);

create table if not exists public.fin_sync_log (
  id          uuid primary key default gen_random_uuid(),
  source      text not null default 'quickbooks',
  entity      text not null,
  status      text not null default 'ok',
  rows_synced int not null default 0,
  message     text,
  synced_at   timestamptz not null default now()
);

create index if not exists fin_sync_log_source_idx on public.fin_sync_log (source, synced_at desc);

drop trigger if exists fin_qb_account_map_set_updated_at on public.fin_qb_account_map;
create trigger fin_qb_account_map_set_updated_at before update on public.fin_qb_account_map
  for each row execute function public.fin_set_updated_at();

-- catch-all account for unmapped QB lines
insert into public.fin_account (id, name, section, cost_behavior, direct_type, sort_order) values
  ('unmapped', 'Unmapped (QuickBooks)', 'other_expense', 'fixed', 'na', 999)
on conflict (id) do nothing;

-- best-guess QB -> fin_account map (editable in Settings)
insert into public.fin_qb_account_map (qb_account_name, fin_account_id) values
  ('Sales', 'revenue'), ('Income', 'revenue'), ('Services', 'revenue'),
  ('Cost of Goods Sold', 'cogs_materials'), ('Materials', 'cogs_materials'),
  ('Subcontractors', 'subcontractor'),
  ('Direct Labor', 'cogs_labor'), ('Field Wages', 'cogs_labor'),
  ('Payroll', 'wages_overhead'), ('Wages', 'wages_overhead'), ('Salaries', 'wages_overhead'),
  ('Rent', 'rent'), ('Facilities', 'rent'),
  ('Insurance', 'insurance'),
  ('Franchise Tax', 'franchise_tax'), ('Taxes', 'franchise_tax'),
  ('Owner Draw', 'distributions'), ('Distributions', 'distributions')
on conflict (qb_account_id) do nothing;

-- RLS: admin-only (read + write) on the two new tables
do $$
declare t text;
begin
  foreach t in array array['fin_qb_account_map','fin_sync_log']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_admin_all on public.%I;', t, t);
    execute format($f$create policy %I_admin_all on public.%I for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));$f$, t, t);
  end loop;
end $$;
