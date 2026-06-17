-- Warehouse KPI Log: daily ops log + management sign-off.
-- Two tables:
--   kpi_log_sections  — six seeded sections with KPI targets banner content
--   kpi_log_entries   — Nate's daily entries; payload is JSONB per section
--
-- Office submits, admin signs off, field is read-only (RLS).
-- Additive only.

create table if not exists public.kpi_log_sections (
  id           text primary key,                       -- slug, e.g. 'material_readiness'
  title        text not null,
  sort_order   int  not null,
  targets      jsonb not null default '[]'::jsonb,     -- [{label, value}]
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.kpi_log_entries (
  id              uuid primary key default gen_random_uuid(),
  section_id      text not null references public.kpi_log_sections(id) on delete restrict,
  entry_date      date not null default current_date,
  pass_fail       text not null default 'na' check (pass_fail in ('pass','fail','na')),
  payload         jsonb not null default '{}'::jsonb,  -- section-specific fields
  notes           text,
  mgmt_notes      text,
  mgmt_signed_by  uuid references auth.users(id) on delete set null,
  mgmt_signed_at  timestamptz,
  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists kpi_log_entries_section_date_idx
  on public.kpi_log_entries (section_id, entry_date desc);

create index if not exists kpi_log_entries_pending_idx
  on public.kpi_log_entries (section_id)
  where mgmt_signed_by is null;

-- updated_at trigger (reuse if a tg_set_updated_at function already exists)
create or replace function public.kpi_log_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kpi_log_sections_set_updated_at on public.kpi_log_sections;
create trigger kpi_log_sections_set_updated_at
  before update on public.kpi_log_sections
  for each row execute function public.kpi_log_set_updated_at();

drop trigger if exists kpi_log_entries_set_updated_at on public.kpi_log_entries;
create trigger kpi_log_entries_set_updated_at
  before update on public.kpi_log_entries
  for each row execute function public.kpi_log_set_updated_at();

-- ---------- Seed sections ----------------------------------------------------

insert into public.kpi_log_sections (id, title, sort_order, targets) values
  (
    'material_readiness',
    'Material Readiness & Prep',
    10,
    '[
      {"label":"Material Readiness","value":"100% on time"},
      {"label":"Delivery on Schedule","value":"95%+"},
      {"label":"Batch Tracking","value":"100%"}
    ]'::jsonb
  ),
  (
    'inventory_mgmt',
    'Inventory Management',
    20,
    '[
      {"label":"Inventory Accuracy","value":"95%+"},
      {"label":"Stockouts","value":"<2 per quarter"},
      {"label":"Overstock","value":"<5% of inventory value"},
      {"label":"Turnover","value":"4–6x per year"}
    ]'::jsonb
  ),
  (
    'warehouse_ops',
    'Warehouse Ops & Organization',
    30,
    '[
      {"label":"Safety Incidents","value":"0 per quarter"},
      {"label":"Equipment Downtime","value":"<2%"},
      {"label":"Material Waste","value":"<3% of material value"},
      {"label":"Tool Checkout Compliance","value":"95%+"}
    ]'::jsonb
  ),
  (
    'equipment',
    'Equipment & Facilities',
    40,
    '[
      {"label":"Preventive Maintenance","value":"On schedule"}
    ]'::jsonb
  ),
  (
    'vendor_turfcasa',
    'Vendor Relations & TurfCasa',
    50,
    '[
      {"label":"TurfCasa Order Fulfillment Accuracy","value":"98%+"}
    ]'::jsonb
  ),
  (
    'texasturf_jobs',
    'TexasTurf Job Fulfillment',
    60,
    '[
      {"label":"TexasTurf Job Fulfillment Accuracy","value":"98%+"}
    ]'::jsonb
  )
on conflict (id) do update
  set title      = excluded.title,
      sort_order = excluded.sort_order,
      targets    = excluded.targets;

-- ---------- RLS --------------------------------------------------------------

alter table public.kpi_log_sections enable row level security;
alter table public.kpi_log_entries  enable row level security;

-- Sections: any signed-in user can read. Only admins mutate (rare).
drop policy if exists kpi_log_sections_select on public.kpi_log_sections;
create policy kpi_log_sections_select
  on public.kpi_log_sections
  for select to authenticated using (true);

drop policy if exists kpi_log_sections_admin_write on public.kpi_log_sections;
create policy kpi_log_sections_admin_write
  on public.kpi_log_sections
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Entries: any signed-in user can read; admin+office can insert; updates are
-- gated server-side (creator can edit content, admin can edit sign-off cols).
drop policy if exists kpi_log_entries_select on public.kpi_log_entries;
create policy kpi_log_entries_select
  on public.kpi_log_entries
  for select to authenticated using (true);

drop policy if exists kpi_log_entries_insert on public.kpi_log_entries;
create policy kpi_log_entries_insert
  on public.kpi_log_entries
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin','office')
    )
    and created_by = auth.uid()
  );

drop policy if exists kpi_log_entries_update on public.kpi_log_entries;
create policy kpi_log_entries_update
  on public.kpi_log_entries
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin','office')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin','office')
    )
  );

drop policy if exists kpi_log_entries_delete on public.kpi_log_entries;
create policy kpi_log_entries_delete
  on public.kpi_log_entries
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
