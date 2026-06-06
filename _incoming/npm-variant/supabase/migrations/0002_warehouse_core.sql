-- TexasTurf Command Center: Warehouse module.
-- Covers Ivana's daily workflow: pull lists, equipment inspections,
-- delivery confirmations, vehicle maintenance log, tool/equipment purchases.
-- Replaces three paper PDF templates and two Google Forms / Sheets.

create extension if not exists pgcrypto;

-- Shared touch trigger so updated_at stays honest without app-side bookkeeping.
create or replace function warehouse_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Employees: people who show up in pull lists, inspections, deliveries,
-- maintenance logs, tool purchases. Kept thin so it can co-exist with — and
-- eventually be linked to — Supabase Auth users (`auth.users`) when Google
-- SSO lands. `role` here is a job role, not an app permission tier.
-- ---------------------------------------------------------------------------
create table if not exists warehouse_employees (
  id            uuid        primary key default gen_random_uuid(),
  first_name    text        not null,
  last_name     text,
  display_name  text        generated always as (
                  case
                    when last_name is null or last_name = '' then first_name
                    else first_name || ' ' || last_name
                  end
                ) stored,
  role          text        check (role in (
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
create index if not exists warehouse_employees_active_idx on warehouse_employees(is_active);
create index if not exists warehouse_employees_role_idx   on warehouse_employees(role);
create index if not exists warehouse_employees_name_idx   on warehouse_employees
  using gin (to_tsvector('simple', display_name));
create trigger warehouse_employees_touch
  before update on warehouse_employees
  for each row execute function warehouse_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Assets: anything inspectable, maintainable, or purchased.
-- Trucks + trailers + heavy equipment + small tools all live here so
-- inspections, maintenance, and tool logs can FK in one place.
-- ---------------------------------------------------------------------------
create table if not exists warehouse_assets (
  id            uuid        primary key default gen_random_uuid(),
  kind          text        not null check (kind in ('truck','trailer','heavy_equipment','tool')),
  name          text        not null,
  identifier    text,
  make          text,
  model         text,
  year          integer,
  is_active     boolean     not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists warehouse_assets_kind_idx   on warehouse_assets(kind);
create index if not exists warehouse_assets_active_idx on warehouse_assets(is_active);
create trigger warehouse_assets_touch
  before update on warehouse_assets
  for each row execute function warehouse_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Budgets: target spend per period. Used by the maintenance + tool trackers
-- to show "spent vs budget". Null asset_id means overall (e.g. tool budget).
-- ---------------------------------------------------------------------------
create table if not exists warehouse_budgets (
  id            uuid        primary key default gen_random_uuid(),
  kind          text        not null check (kind in ('vehicle_maintenance','tool_purchases')),
  asset_id      uuid        references warehouse_assets(id) on delete cascade,
  period_start  date        not null,
  period_end    date        not null,
  amount_cents  integer     not null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (period_end >= period_start)
);
create index if not exists warehouse_budgets_kind_idx   on warehouse_budgets(kind);
create index if not exists warehouse_budgets_period_idx on warehouse_budgets(period_start, period_end);
create trigger warehouse_budgets_touch
  before update on warehouse_budgets
  for each row execute function warehouse_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Pull lists: daily material assembly form, one per job.
-- Mirrors the "Pull List Template" (Step 6). People fields are text for now;
-- promote to FK once an employees table exists.
-- ---------------------------------------------------------------------------
create table if not exists warehouse_pull_lists (
  id                  uuid        primary key default gen_random_uuid(),
  job_date            date        not null,
  jobber_visit_id     text        references jobber_visits(id) on delete set null,
  client_id           text        references jobber_clients(id) on delete set null,
  client_name         text,
  address             text,
  job_number          text,
  -- Pre-assignment: FK preferred, text remains as denormalized snapshot /
  -- one-off fallback. Forms set both when a picker is used.
  crew_lead_employee_id  uuid references warehouse_employees(id) on delete set null,
  crew_lead              text,
  driver_employee_id     uuid references warehouse_employees(id) on delete set null,
  driver                 text,
  stager_employee_id     uuid references warehouse_employees(id) on delete set null,
  stager                 text,

  -- Turf header
  turf_product        text,
  turf_batch_number   text,
  turf_linear_runs    text,
  turf_total_sqft     numeric(10,2),

  -- Loose materials — free text per source location (mirrors checkboxes + notes on PDF)
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

  -- Sign-offs
  stager_signed_by    text,
  stager_signed_at    timestamptz,
  driver_signed_by    text,
  driver_signed_at    timestamptz,
  lead_signed_by      text,
  lead_signed_at      timestamptz,

  status              text not null default 'draft'
                        check (status in ('draft','pulled','staged','dispatched','delivered')),
  notes               text,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists warehouse_pull_lists_date_idx     on warehouse_pull_lists(job_date desc);
create index if not exists warehouse_pull_lists_visit_idx    on warehouse_pull_lists(jobber_visit_id);
create index if not exists warehouse_pull_lists_client_idx   on warehouse_pull_lists(client_id);
create index if not exists warehouse_pull_lists_status_idx   on warehouse_pull_lists(status);
create trigger warehouse_pull_lists_touch
  before update on warehouse_pull_lists
  for each row execute function warehouse_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Pull list rolls: line items for "ROLL NUMBER / LENGTHS NEEDED" table.
-- Kept relational (not jsonb) because rolls will eventually FK to inventory
-- when the Base44 port lands. Lengths stay text — crews write "18, 14, 12".
-- ---------------------------------------------------------------------------
create table if not exists warehouse_pull_list_rolls (
  id              uuid        primary key default gen_random_uuid(),
  pull_list_id    uuid        not null references warehouse_pull_lists(id) on delete cascade,
  position        integer     not null default 0,
  roll_number     text        not null,
  lengths_needed  text,
  created_at      timestamptz not null default now()
);
create index if not exists warehouse_pull_list_rolls_list_idx on warehouse_pull_list_rolls(pull_list_id, position);

-- ---------------------------------------------------------------------------
-- Inspections: pre-departure checklist (Step 18).
-- items jsonb mirrors the four PDF sections; promote to a normalized
-- inspection_items table later if we want per-item failure analytics.
-- Example items shape:
--   { "trailer":{"tires":true,"lights":true,"hitch":true,"chains":true,"dump":null,"ramps":true},
--     "truck":{"fuel":true,"oil":true,"tire_pressure":true,"brakes":true,"mirrors":true},
--     "heavy_equipment":{"secured":true,"ramps_stowed":true,"fuel":true,"no_leaks":true},
--     "tools":{"loaded":true,"batteries":true,"fuel_cans":true,"ppe":true} }
-- ---------------------------------------------------------------------------
create table if not exists warehouse_inspections (
  id              uuid        primary key default gen_random_uuid(),
  truck_id        uuid        references warehouse_assets(id) on delete set null,
  trailer_id      uuid        references warehouse_assets(id) on delete set null,
  equipment_id    uuid        references warehouse_assets(id) on delete set null,
  pull_list_id        uuid    references warehouse_pull_lists(id) on delete set null,
  inspector_employee_id uuid  references warehouse_employees(id) on delete set null,
  inspector       text        not null,
  inspected_at    timestamptz not null default now(),
  items           jsonb       not null default '{}'::jsonb,
  result          text        not null check (result in ('pass','fail')),
  failure_notes   text,
  photos          jsonb       not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists warehouse_inspections_date_idx    on warehouse_inspections(inspected_at desc);
create index if not exists warehouse_inspections_truck_idx   on warehouse_inspections(truck_id);
create index if not exists warehouse_inspections_trailer_idx on warehouse_inspections(trailer_id);
create index if not exists warehouse_inspections_result_idx  on warehouse_inspections(result);
create trigger warehouse_inspections_touch
  before update on warehouse_inspections
  for each row execute function warehouse_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Delivery confirmations: Step 35 Slack post.
-- materials jsonb keeps the loose structure of the Slack message
-- (turf product/sqft/batch, DG yards, infill type+bags, fasteners boxes).
-- slack_message_ts is null until the post lands; once set, treat the row as
-- "posted" — idempotent re-post becomes an explicit re-action.
-- v1 routes everything to one warehouse-wide channel (env var
-- SLACK_WAREHOUSE_CHANNEL). slack_channel is kept here for future per-job
-- override without a schema change.
-- ---------------------------------------------------------------------------
create table if not exists warehouse_deliveries (
  id                  uuid        primary key default gen_random_uuid(),
  pull_list_id        uuid        references warehouse_pull_lists(id) on delete set null,
  jobber_visit_id     text        references jobber_visits(id) on delete set null,
  client_id           text        references jobber_clients(id) on delete set null,
  client_name         text,
  address             text,
  delivered_at        timestamptz not null default now(),
  materials           jsonb       not null default '{}'::jsonb,
  received_by_employee_id uuid    references warehouse_employees(id) on delete set null,
  received_by         text,
  staging_location    text,
  notes               text,
  photo_url           text,
  slack_channel       text,
  slack_message_ts    text,
  slack_posted_at     timestamptz,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists warehouse_deliveries_date_idx   on warehouse_deliveries(delivered_at desc);
create index if not exists warehouse_deliveries_pull_idx   on warehouse_deliveries(pull_list_id);
create index if not exists warehouse_deliveries_visit_idx  on warehouse_deliveries(jobber_visit_id);
create index if not exists warehouse_deliveries_slack_idx  on warehouse_deliveries(slack_message_ts)
  where slack_message_ts is not null;
create trigger warehouse_deliveries_touch
  before update on warehouse_deliveries
  for each row execute function warehouse_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Vehicle maintenance log: replaces the Google Form / Sheet.
-- asset_id is required + restricted so we never orphan a cost row.
-- ---------------------------------------------------------------------------
create table if not exists warehouse_vehicle_maintenance (
  id              uuid        primary key default gen_random_uuid(),
  asset_id        uuid        not null references warehouse_assets(id) on delete restrict,
  service_date    date        not null,
  service_type    text        not null,
  vendor          text,
  description     text,
  cost_cents      integer     not null default 0,
  odometer        integer,
  invoice_url     text,
  submitted_by_employee_id uuid references warehouse_employees(id) on delete set null,
  submitted_by    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists warehouse_vehicle_maint_asset_idx on warehouse_vehicle_maintenance(asset_id);
create index if not exists warehouse_vehicle_maint_date_idx  on warehouse_vehicle_maintenance(service_date desc);
create trigger warehouse_vehicle_maint_touch
  before update on warehouse_vehicle_maintenance
  for each row execute function warehouse_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Tool & small-equipment purchases: replaces the Google Form / Sheet.
-- asset_id optional — most purchases are loose items not tracked as assets.
-- When asset_id is set we treat the purchase as the acquisition cost.
-- ---------------------------------------------------------------------------
create table if not exists warehouse_tool_purchases (
  id              uuid        primary key default gen_random_uuid(),
  asset_id        uuid        references warehouse_assets(id) on delete set null,
  purchase_date   date        not null,
  item_name       text        not null,
  vendor          text,
  quantity        integer     not null default 1,
  cost_cents      integer     not null default 0,
  category        text        not null default 'tool'
                    check (category in ('tool','small_equipment','supply')),
  crew            text,
  receipt_url     text,
  submitted_by_employee_id uuid references warehouse_employees(id) on delete set null,
  submitted_by    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists warehouse_tool_purchases_date_idx     on warehouse_tool_purchases(purchase_date desc);
create index if not exists warehouse_tool_purchases_category_idx on warehouse_tool_purchases(category);
create index if not exists warehouse_tool_purchases_asset_idx    on warehouse_tool_purchases(asset_id);
create trigger warehouse_tool_purchases_touch
  before update on warehouse_tool_purchases
  for each row execute function warehouse_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: match the jobber_* pattern — lock down by default, service role
-- bypasses, browser anon gets nothing. Per-row policies land when Supabase
-- Auth (Google SSO) + the Admin/Office/Field role taxonomy are wired up.
-- ---------------------------------------------------------------------------
alter table warehouse_employees            enable row level security;
alter table warehouse_assets               enable row level security;
alter table warehouse_budgets              enable row level security;
alter table warehouse_pull_lists           enable row level security;
alter table warehouse_pull_list_rolls      enable row level security;
alter table warehouse_inspections          enable row level security;
alter table warehouse_deliveries           enable row level security;
alter table warehouse_vehicle_maintenance  enable row level security;
alter table warehouse_tool_purchases       enable row level security;
