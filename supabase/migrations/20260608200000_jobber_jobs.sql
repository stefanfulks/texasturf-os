-- TexasTurf OS — Jobber jobs mirror.
--
-- Mirrors Jobber's Job entity into Supabase so the OS can show jobs
-- alongside internal data (warehouse pulls, fleet assignment, etc.)
-- without hitting Jobber on every page load. Webhooks (JOB_CREATE /
-- JOB_UPDATE / JOB_DESTROY) keep it live; the manual sync seeds it.
--
-- Foreign key on jobber_account_id matches jobber_clients / jobber_visits.
-- No FK on client_id or property_id — those entities may sync later, and
-- we want a JOB_CREATE webhook to land cleanly even if the client mirror
-- hasn't caught up yet.

create table if not exists public.jobber_jobs (
  id                 text primary key,
  jobber_account_id  text not null references public.jobber_oauth_tokens(jobber_account_id) on delete cascade,
  job_number         text,
  title              text,
  status             text,
  start_at           timestamptz,
  end_at             timestamptz,
  completed_at       timestamptz,
  total_cents        integer,
  client_id          text,
  property_id        text,
  jobber_created_at  timestamptz,
  jobber_updated_at  timestamptz,
  raw                jsonb,
  synced_at          timestamptz not null default now()
);

create index if not exists jobber_jobs_account_idx   on public.jobber_jobs(jobber_account_id);
create index if not exists jobber_jobs_client_idx    on public.jobber_jobs(client_id);
create index if not exists jobber_jobs_status_idx    on public.jobber_jobs(status);
create index if not exists jobber_jobs_start_idx     on public.jobber_jobs(start_at);
create index if not exists jobber_jobs_completed_idx on public.jobber_jobs(completed_at);

alter table public.jobber_jobs enable row level security;
