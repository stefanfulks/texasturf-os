-- TexasTurf OS — Field job progress state machine
--
-- Field installers tap through a series of state transitions as they
-- execute a job. Each tap records:
--   * which Jobber visit (the source of truth for "what's scheduled")
--   * the new state
--   * who tapped + when
--   * optional notes
--
-- The CURRENT state of a job is "the most-recent event's state for that
-- jobber_visit_id." Append-only — no UPDATE, no DELETE except admin.
-- This gives us a timeline for free + makes the client portal trivial.
--
-- Idempotent — safe to re-run.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. State enum (matches Stefan's field-spec order)
-- ───────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.job_progress_state as enum (
    'scheduled',         -- initial (no event yet)
    'started',           -- crew on site, tear-out in progress
    'tear_out_done',
    'base_started',
    'base_done',
    'turf_started',
    'two_hours_out',     -- triggers customer notify in Phase A3
    'turf_done',
    'final_qa_done',     -- terminal — job done
    'on_hold'            -- escape hatch for delays; can resume to any prior state
  );
exception when duplicate_object then null; end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Optional slack_channel_id on jobber_clients — picked manually per client
--    by an admin on the client detail page (Phase A2).
-- ───────────────────────────────────────────────────────────────────────────

alter table public.jobber_clients
  add column if not exists slack_channel_id text;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. job_progress_events — append-only event log
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.job_progress_events (
  id                  uuid primary key default gen_random_uuid(),

  -- Primary linkage. Most jobs are bound to a Jobber visit; we keep
  -- pull_list_id as an optional back-reference for the warehouse side.
  jobber_visit_id     text references public.jobber_visits(id) on delete set null,
  pull_list_id        uuid references public.warehouse_pull_lists(id) on delete set null,

  state               public.job_progress_state not null,
  notes               text,

  recorded_by_profile uuid references public.profiles(id) on delete set null,
  recorded_at         timestamptz not null default now()
);

-- Newest event per visit drives the "current state" query.
create index if not exists job_progress_events_visit_idx
  on public.job_progress_events (jobber_visit_id, recorded_at desc);

-- Used by /today and dashboard tiles ("today's jobs and their state").
create index if not exists job_progress_events_recent_idx
  on public.job_progress_events (recorded_at desc);

-- Used by client-portal lookups in Phase A3.
create index if not exists job_progress_events_pull_idx
  on public.job_progress_events (pull_list_id) where pull_list_id is not null;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. RLS — all authed users can read; admin/office/field can append.
--    UPDATE / DELETE locked to admin only (state corrections by an admin).
-- ───────────────────────────────────────────────────────────────────────────

alter table public.job_progress_events enable row level security;

drop policy if exists "job_progress read"  on public.job_progress_events;
create policy "job_progress read"
  on public.job_progress_events for select
  to authenticated using (true);

drop policy if exists "job_progress insert" on public.job_progress_events;
create policy "job_progress insert"
  on public.job_progress_events for insert
  to authenticated
  with check (public.current_role() in ('admin','office','field'));

drop policy if exists "job_progress update" on public.job_progress_events;
create policy "job_progress update"
  on public.job_progress_events for update
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists "job_progress delete" on public.job_progress_events;
create policy "job_progress delete"
  on public.job_progress_events for delete
  to authenticated
  using (public.current_role() = 'admin');
