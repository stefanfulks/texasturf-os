-- TexasTurf OS — Phase B1: Warehouse / Operations module
--
-- Ports the npm-variant warehouse schema into the OS, but reconciled with
-- existing tables:
--
--   * Existing `assets` is the single asset table — we extend its unit_type
--     enum to include 'tool' and add make/model/year/identifier columns
--     instead of creating warehouse_assets.
--   * Existing `maintenance_logs` + `maintenance_schedules` are the single
--     source of truth for vehicle maintenance — we extend maintenance_logs
--     with vendor + invoice_url instead of creating
--     warehouse_vehicle_maintenance.
--   * `warehouse_employees` is NEW — covers subcontractor crew (drivers,
--     stagers, installers) who don't have OS logins. Optional profile_id
--     FK links any employee who *does* have an OS login.
--
-- Net new tables: warehouse_employees, warehouse_budgets, warehouse_pull_lists,
-- warehouse_pull_list_rolls, warehouse_inspections, warehouse_deliveries,
-- warehouse_tool_purchases.
--
-- All idempotent (`if not exists`, `do $$ … exception when duplicate_…`).

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Extend existing `assets`: add tool unit_type + make/model/year/identifier
-- ───────────────────────────────────────────────────────────────────────────

-- ALTER TYPE … ADD VALUE has been transactional since Postgres 12; safe in tx.
do $$ begin
  alter type public.unit_type add value if not exists 'tool';
exception when duplicate_object then null; end $$;

alter table public.assets add column if not exists identifier text;
alter table public.assets add column if not exists make text;
alter table public.assets add column if not exists model text;
alter table public.assets add column if not exists year integer;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Extend existing `maintenance_logs`: vendor + invoice_url
--    (existing meter_value covers odometer/hours, no need to add a column)
-- ───────────────────────────────────────────────────────────────────────────

alter table public.maintenance_logs add column if not exists vendor text;
alter table public.maintenance_logs add column if not exists invoice_url text;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. warehouse_employees — pull-list crew, inspectors, deliverers, etc.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.warehouse_employees (
  id            uuid        primary key default gen_random_uuid(),
  -- Optional: if this person has an OS login, link to their profiles row.
  -- Most crew (drivers, stagers, subcontractors) won't have one.
  profile_id    uuid        references public.profiles(id) on delete set null,
  first_name    text        not null,
  last_name     text,
  display_name  text        generated always as (
                  case
                    when last_name is null or last_name = '' then first_name
                    else first_name || ' ' || last_name
                  end
                ) stored,
  job_role      text        check (job_role in (
                  'warehouse','driver','stager','crew_lead',
                  'installer','office','admin','contractor','other'
                )),
  email         text        unique,
  phone         text,
  is_active     boolean     not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists warehouse_employees_active_idx  on public.warehouse_employees(is_active);
create index if not exists warehouse_employees_role_idx    on public.warehouse_employees(job_role);
create index if not exists warehouse_employees_profile_idx on public.warehouse_employees(profile_id);
create index if not exists warehouse_employees_name_idx    on public.warehouse_employees
  using gin (to_tsvector('simple', display_name));

drop trigger if exists touch_warehouse_employees on public.warehouse_employees;
create trigger touch_warehouse_employees before update on public.warehouse_employees
  for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 4. warehouse_budgets — period spending targets for vehicle maint + tools
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.warehouse_budgets (
  id            uuid        primary key default gen_random_uuid(),
  kind          text        not null check (kind in ('vehicle_maintenance','tool_purchases')),
  asset_id      uuid        references public.assets(id) on delete cascade,
  period_start  date        not null,
  period_end    date        not null,
  amount_cents  integer     not null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (period_end >= period_start)
);
create index if not exists warehouse_budgets_kind_idx   on public.warehouse_budgets(kind);
create index if not exists warehouse_budgets_period_idx on public.warehouse_budgets(period_start, period_end);

drop trigger if exists touch_warehouse_budgets on public.warehouse_budgets;
create trigger touch_warehouse_budgets before update on public.warehouse_budgets
  for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 5. warehouse_pull_lists — daily material assembly form (one per job/visit).
--    FKs to jobber_visits / jobber_clients (Phase A) and warehouse_employees.
--    Optional inv_allocation_id pulls the inventory-ledger linkage along.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.warehouse_pull_lists (
  id                  uuid        primary key default gen_random_uuid(),
  job_date            date        not null,
  jobber_visit_id     text        references public.jobber_visits(id) on delete set null,
  client_id           text        references public.jobber_clients(id) on delete set null,
  inv_allocation_id   uuid        references public.inv_allocations(id) on delete set null,
  client_name         text,
  address             text,
  job_number          text,

  -- Crew assignments. employee_id is preferred; text fallback for one-offs
  -- where we haven't created a warehouse_employees row yet.
  crew_lead_employee_id  uuid references public.warehouse_employees(id) on delete set null,
  crew_lead              text,
  driver_employee_id     uuid references public.warehouse_employees(id) on delete set null,
  driver                 text,
  stager_employee_id     uuid references public.warehouse_employees(id) on delete set null,
  stager                 text,

  -- Turf header (denormalized snapshot; rolls table has the detail)
  turf_product        text,
  turf_batch_number   text,
  turf_linear_runs    text,
  turf_total_sqft     numeric(10,2),

  -- Loose materials — free text per source location
  loose_warehouse        text,
  loose_yard_delivery    text,
  loose_yard_pickup      text,

  -- Bagged products
  bagged_none             boolean not null default false,
  bagged_standard_sand    integer not null default 0,
  bagged_fine_sand        integer not null default 0,
  bagged_wonderfill       integer not null default 0,
  bagged_misc             integer not null default 0,

  -- Fasteners & supplies
  nails_boxes         integer not null default 0,
  staples_boxes       integer not null default 0,
  glue_gal            integer not null default 0,
  seam_tape_rolls     integer not null default 0,
  weed_barrier        text,

  -- Sign-offs (text + timestamps; employee_id captured at sign time)
  stager_signed_by    text,
  stager_signed_at    timestamptz,
  driver_signed_by    text,
  driver_signed_at    timestamptz,
  lead_signed_by      text,
  lead_signed_at      timestamptz,

  status              text not null default 'draft'
                        check (status in ('draft','pulled','staged','dispatched','delivered')),
  notes               text,
  created_by_profile  uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists warehouse_pull_lists_date_idx   on public.warehouse_pull_lists(job_date desc);
create index if not exists warehouse_pull_lists_visit_idx  on public.warehouse_pull_lists(jobber_visit_id);
create index if not exists warehouse_pull_lists_client_idx on public.warehouse_pull_lists(client_id);
create index if not exists warehouse_pull_lists_alloc_idx  on public.warehouse_pull_lists(inv_allocation_id);
create index if not exists warehouse_pull_lists_status_idx on public.warehouse_pull_lists(status);

drop trigger if exists touch_warehouse_pull_lists on public.warehouse_pull_lists;
create trigger touch_warehouse_pull_lists before update on public.warehouse_pull_lists
  for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 6. warehouse_pull_list_rolls — line items for the ROLL NUMBER table.
--    Optional inv_roll_id ties this row to the actual inventory roll.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.warehouse_pull_list_rolls (
  id              uuid        primary key default gen_random_uuid(),
  pull_list_id    uuid        not null references public.warehouse_pull_lists(id) on delete cascade,
  inv_roll_id     uuid        references public.inv_rolls(id) on delete set null,
  position        integer     not null default 0,
  roll_number     text        not null,
  lengths_needed  text,
  created_at      timestamptz not null default now()
);
create index if not exists warehouse_pull_list_rolls_list_idx on public.warehouse_pull_list_rolls(pull_list_id, position);
create index if not exists warehouse_pull_list_rolls_roll_idx on public.warehouse_pull_list_rolls(inv_roll_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 7. warehouse_inspections — pre-departure checklist. Asset FKs target the
--    existing `assets` table (no warehouse_assets in OS).
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.warehouse_inspections (
  id              uuid        primary key default gen_random_uuid(),
  truck_id        uuid        references public.assets(id) on delete set null,
  trailer_id      uuid        references public.assets(id) on delete set null,
  equipment_id    uuid        references public.assets(id) on delete set null,
  pull_list_id    uuid        references public.warehouse_pull_lists(id) on delete set null,
  inspector_employee_id uuid  references public.warehouse_employees(id) on delete set null,
  inspector       text        not null,
  inspected_at    timestamptz not null default now(),
  -- jsonb shape mirrors the four PDF sections (trailer/truck/heavy/tools).
  items           jsonb       not null default '{}'::jsonb,
  result          text        not null check (result in ('pass','fail')),
  failure_notes   text,
  photos          jsonb       not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists warehouse_inspections_date_idx    on public.warehouse_inspections(inspected_at desc);
create index if not exists warehouse_inspections_truck_idx   on public.warehouse_inspections(truck_id);
create index if not exists warehouse_inspections_trailer_idx on public.warehouse_inspections(trailer_id);
create index if not exists warehouse_inspections_result_idx  on public.warehouse_inspections(result);

drop trigger if exists touch_warehouse_inspections on public.warehouse_inspections;
create trigger touch_warehouse_inspections before update on public.warehouse_inspections
  for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 8. warehouse_deliveries — Slack-posted delivery confirmations.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.warehouse_deliveries (
  id                  uuid        primary key default gen_random_uuid(),
  pull_list_id        uuid        references public.warehouse_pull_lists(id) on delete set null,
  jobber_visit_id     text        references public.jobber_visits(id) on delete set null,
  client_id           text        references public.jobber_clients(id) on delete set null,
  client_name         text,
  address             text,
  delivered_at        timestamptz not null default now(),
  -- jsonb captures the Slack-message structure (turf product/sqft/batch,
  -- DG yards, infill type+bags, fasteners boxes)
  materials           jsonb       not null default '{}'::jsonb,
  received_by_employee_id uuid    references public.warehouse_employees(id) on delete set null,
  received_by         text,
  staging_location    text,
  notes               text,
  photo_url           text,
  slack_channel       text,
  slack_message_ts    text,
  slack_posted_at     timestamptz,
  created_by_profile  uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists warehouse_deliveries_date_idx   on public.warehouse_deliveries(delivered_at desc);
create index if not exists warehouse_deliveries_pull_idx   on public.warehouse_deliveries(pull_list_id);
create index if not exists warehouse_deliveries_visit_idx  on public.warehouse_deliveries(jobber_visit_id);
create index if not exists warehouse_deliveries_slack_idx  on public.warehouse_deliveries(slack_message_ts)
  where slack_message_ts is not null;

drop trigger if exists touch_warehouse_deliveries on public.warehouse_deliveries;
create trigger touch_warehouse_deliveries before update on public.warehouse_deliveries
  for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 9. warehouse_tool_purchases — quick field log for small purchases.
--    Sits alongside `invoices`; not OCR'd, no approval workflow.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.warehouse_tool_purchases (
  id              uuid        primary key default gen_random_uuid(),
  asset_id        uuid        references public.assets(id) on delete set null,
  purchase_date   date        not null,
  item_name       text        not null,
  vendor          text,
  quantity        integer     not null default 1,
  cost_cents      integer     not null default 0,
  category        text        not null default 'tool'
                    check (category in ('tool','small_equipment','supply')),
  crew            text,
  receipt_url     text,
  submitted_by_employee_id uuid references public.warehouse_employees(id) on delete set null,
  submitted_by_profile     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists warehouse_tool_purchases_date_idx     on public.warehouse_tool_purchases(purchase_date desc);
create index if not exists warehouse_tool_purchases_category_idx on public.warehouse_tool_purchases(category);
create index if not exists warehouse_tool_purchases_asset_idx    on public.warehouse_tool_purchases(asset_id);

drop trigger if exists touch_warehouse_tool_purchases on public.warehouse_tool_purchases;
create trigger touch_warehouse_tool_purchases before update on public.warehouse_tool_purchases
  for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 10. RLS — mirror existing fleet/maintenance pattern: all authed users can
--     read, admin + office can write.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.warehouse_employees           enable row level security;
alter table public.warehouse_budgets             enable row level security;
alter table public.warehouse_pull_lists          enable row level security;
alter table public.warehouse_pull_list_rolls     enable row level security;
alter table public.warehouse_inspections         enable row level security;
alter table public.warehouse_deliveries          enable row level security;
alter table public.warehouse_tool_purchases      enable row level security;

do $$ begin
  -- Helper closure: emit the same read+write pair for each warehouse table.
  perform 1;
end $$;

drop policy if exists "warehouse_employees read"   on public.warehouse_employees;
create policy "warehouse_employees read"
  on public.warehouse_employees for select to authenticated using (true);
drop policy if exists "warehouse_employees write"  on public.warehouse_employees;
create policy "warehouse_employees write"
  on public.warehouse_employees for all to authenticated
  using (public.current_role() in ('admin','office'))
  with check (public.current_role() in ('admin','office'));

drop policy if exists "warehouse_budgets read"     on public.warehouse_budgets;
create policy "warehouse_budgets read"
  on public.warehouse_budgets for select to authenticated using (true);
drop policy if exists "warehouse_budgets write"    on public.warehouse_budgets;
create policy "warehouse_budgets write"
  on public.warehouse_budgets for all to authenticated
  using (public.current_role() in ('admin','office'))
  with check (public.current_role() in ('admin','office'));

drop policy if exists "warehouse_pull_lists read"  on public.warehouse_pull_lists;
create policy "warehouse_pull_lists read"
  on public.warehouse_pull_lists for select to authenticated using (true);
drop policy if exists "warehouse_pull_lists write" on public.warehouse_pull_lists;
create policy "warehouse_pull_lists write"
  on public.warehouse_pull_lists for all to authenticated
  using (public.current_role() in ('admin','office'))
  with check (public.current_role() in ('admin','office'));

drop policy if exists "warehouse_pull_list_rolls read"  on public.warehouse_pull_list_rolls;
create policy "warehouse_pull_list_rolls read"
  on public.warehouse_pull_list_rolls for select to authenticated using (true);
drop policy if exists "warehouse_pull_list_rolls write" on public.warehouse_pull_list_rolls;
create policy "warehouse_pull_list_rolls write"
  on public.warehouse_pull_list_rolls for all to authenticated
  using (public.current_role() in ('admin','office'))
  with check (public.current_role() in ('admin','office'));

drop policy if exists "warehouse_inspections read"      on public.warehouse_inspections;
create policy "warehouse_inspections read"
  on public.warehouse_inspections for select to authenticated using (true);
drop policy if exists "warehouse_inspections write"     on public.warehouse_inspections;
create policy "warehouse_inspections write"
  on public.warehouse_inspections for all to authenticated
  using (public.current_role() in ('admin','office'))
  with check (public.current_role() in ('admin','office'));

drop policy if exists "warehouse_deliveries read"       on public.warehouse_deliveries;
create policy "warehouse_deliveries read"
  on public.warehouse_deliveries for select to authenticated using (true);
drop policy if exists "warehouse_deliveries write"      on public.warehouse_deliveries;
create policy "warehouse_deliveries write"
  on public.warehouse_deliveries for all to authenticated
  using (public.current_role() in ('admin','office'))
  with check (public.current_role() in ('admin','office'));

drop policy if exists "warehouse_tool_purchases read"   on public.warehouse_tool_purchases;
create policy "warehouse_tool_purchases read"
  on public.warehouse_tool_purchases for select to authenticated using (true);
drop policy if exists "warehouse_tool_purchases write"  on public.warehouse_tool_purchases;
create policy "warehouse_tool_purchases write"
  on public.warehouse_tool_purchases for all to authenticated
  using (public.current_role() in ('admin','office'))
  with check (public.current_role() in ('admin','office'));
