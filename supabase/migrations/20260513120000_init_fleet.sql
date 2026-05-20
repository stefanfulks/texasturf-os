-- TexasTurf OS — Phase 1: Fleet & Equipment module
-- Idempotent so you can re-run safely while iterating.

-- ─────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.user_role as enum ('admin', 'office', 'field');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.unit_type as enum ('truck', 'trailer', 'heavy_equipment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_status as enum (
    'available',
    'assigned_to_job',
    'in_use_today',
    'maintenance_needed',
    'out_of_service'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ready_status as enum ('ready', 'needs_prep', 'not_ready');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.load_status as enum (
    'empty',
    'partially_loaded',
    'fully_loaded',
    'trash'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.maintenance_interval_type as enum ('time', 'mileage', 'hours');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────
-- profiles — extends auth.users with role + display info
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.user_role not null default 'office',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Convenience function used by RLS policies.
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────────────
-- assets — trucks, trailers, heavy equipment
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit_type public.unit_type not null,
  status public.asset_status not null default 'available',
  ready_status public.ready_status not null default 'ready',
  load_status public.load_status not null default 'empty',
  primary_unit boolean not null default false,
  -- Self-reference for the "what's hooked to what" rig pattern from Monday.
  attached_to_id uuid references public.assets(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  next_action text,
  notes text,
  -- Bookkeeping
  monday_item_id text unique,  -- original Monday item id, for traceable migration
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assets_unit_type_idx on public.assets (unit_type);
create index if not exists assets_status_idx on public.assets (status);
create index if not exists assets_attached_to_idx on public.assets (attached_to_id);

-- ─────────────────────────────────────────────────────────────────────
-- maintenance_schedules — when service is next due, per asset
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  name text not null,                                    -- "Oil change", "5000-hour service", etc.
  interval_type public.maintenance_interval_type not null,
  interval_value numeric not null check (interval_value > 0),
  last_serviced_at timestamptz,
  last_serviced_meter numeric,                           -- last mileage/hour reading when serviced
  next_due_at timestamptz,                               -- for time-based; null otherwise
  next_due_meter numeric,                                -- for mileage/hours; null otherwise
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maintenance_schedules_asset_idx
  on public.maintenance_schedules (asset_id);
create index if not exists maintenance_schedules_next_due_idx
  on public.maintenance_schedules (next_due_at)
  where active = true;

-- ─────────────────────────────────────────────────────────────────────
-- maintenance_logs — completed service events with cost
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  schedule_id uuid references public.maintenance_schedules(id) on delete set null,
  performed_at timestamptz not null default now(),
  description text not null,
  cost_cents bigint not null default 0 check (cost_cents >= 0),
  meter_value numeric,                                   -- mileage or hours at service
  performed_by_profile uuid references public.profiles(id) on delete set null,
  performed_by_vendor text,                              -- if external shop
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists maintenance_logs_asset_idx on public.maintenance_logs (asset_id);
create index if not exists maintenance_logs_performed_at_idx
  on public.maintenance_logs (performed_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_assets on public.assets;
create trigger touch_assets before update on public.assets
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_maintenance_schedules on public.maintenance_schedules;
create trigger touch_maintenance_schedules before update on public.maintenance_schedules
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- RLS — Admin/Office have write; Field is read-only.
-- ─────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.assets enable row level security;
alter table public.maintenance_schedules enable row level security;
alter table public.maintenance_logs enable row level security;

-- profiles: anyone signed in can read; only self can update their row;
-- admins can update any row (role changes).
drop policy if exists "profiles select authenticated" on public.profiles;
create policy "profiles select authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "profiles admin manage" on public.profiles;
create policy "profiles admin manage"
  on public.profiles for all
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- assets: all signed-in can read; admin/office can write.
drop policy if exists "assets select authenticated" on public.assets;
create policy "assets select authenticated"
  on public.assets for select
  to authenticated
  using (true);

drop policy if exists "assets office write" on public.assets;
create policy "assets office write"
  on public.assets for all
  to authenticated
  using (public.current_role() in ('admin', 'office'))
  with check (public.current_role() in ('admin', 'office'));

-- maintenance_schedules: same pattern.
drop policy if exists "schedules select authenticated" on public.maintenance_schedules;
create policy "schedules select authenticated"
  on public.maintenance_schedules for select
  to authenticated
  using (true);

drop policy if exists "schedules office write" on public.maintenance_schedules;
create policy "schedules office write"
  on public.maintenance_schedules for all
  to authenticated
  using (public.current_role() in ('admin', 'office'))
  with check (public.current_role() in ('admin', 'office'));

-- maintenance_logs: same.
drop policy if exists "logs select authenticated" on public.maintenance_logs;
create policy "logs select authenticated"
  on public.maintenance_logs for select
  to authenticated
  using (true);

drop policy if exists "logs office write" on public.maintenance_logs;
create policy "logs office write"
  on public.maintenance_logs for all
  to authenticated
  using (public.current_role() in ('admin', 'office'))
  with check (public.current_role() in ('admin', 'office'));
