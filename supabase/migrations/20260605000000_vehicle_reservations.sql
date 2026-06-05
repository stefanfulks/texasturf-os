-- TexasTurf OS — Vehicle reservations
-- Lets sales/installers reserve a work vehicle for a date range so two
-- people don't show up Monday morning fighting over the F-250.
-- Idempotent so it can be re-run while iterating.

do $$ begin
  create type public.reservation_status as enum ('active', 'cancelled', 'completed');
exception when duplicate_object then null; end $$;

create table if not exists public.vehicle_reservations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  purpose text not null,
  destination text,
  notes text,
  status public.reservation_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists vehicle_reservations_asset_idx
  on public.vehicle_reservations (asset_id, starts_at);
create index if not exists vehicle_reservations_driver_idx
  on public.vehicle_reservations (driver_id, starts_at);
create index if not exists vehicle_reservations_window_idx
  on public.vehicle_reservations (starts_at, ends_at)
  where status = 'active';

drop trigger if exists touch_vehicle_reservations on public.vehicle_reservations;
create trigger touch_vehicle_reservations before update on public.vehicle_reservations
  for each row execute function public.touch_updated_at();

alter table public.vehicle_reservations enable row level security;

-- Anyone signed in can see the schedule.
drop policy if exists "reservations select authenticated" on public.vehicle_reservations;
create policy "reservations select authenticated"
  on public.vehicle_reservations for select
  to authenticated
  using (true);

-- Office/admin can manage any reservation; field users can manage their own.
drop policy if exists "reservations office write" on public.vehicle_reservations;
create policy "reservations office write"
  on public.vehicle_reservations for all
  to authenticated
  using (public.current_role() in ('admin', 'office'))
  with check (public.current_role() in ('admin', 'office'));

drop policy if exists "reservations driver self-manage" on public.vehicle_reservations;
create policy "reservations driver self-manage"
  on public.vehicle_reservations for all
  to authenticated
  using (driver_id = auth.uid() or created_by = auth.uid())
  with check (driver_id = auth.uid() or created_by = auth.uid());
