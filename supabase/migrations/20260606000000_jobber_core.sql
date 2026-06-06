-- TexasTurf OS — Jobber integration core tables.
--
-- Provides:
--   * jobber_oauth_tokens   — one row per connected Jobber account
--   * jobber_clients        — mirror of Jobber clients (full-text search index)
--   * jobber_visits         — mirror of visits for the today/agenda views
--   * jobber_webhook_events — append-only audit log of every webhook delivery
--
-- All tables RLS-enabled; service role bypasses, browser anon gets nothing
-- until we wire per-row auth policies later.

create extension if not exists pgcrypto;

-- One Jobber account installs the app; tokens are stored per Jobber account id.
create table if not exists public.jobber_oauth_tokens (
  jobber_account_id text primary key,
  access_token      text        not null,
  refresh_token     text        not null,
  expires_at        timestamptz not null,
  scopes            text[]      not null default '{}',
  installed_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Mirror of Jobber clients. id is the Jobber Encoded ID.
create table if not exists public.jobber_clients (
  id                 text primary key,
  jobber_account_id  text not null references public.jobber_oauth_tokens(jobber_account_id) on delete cascade,
  first_name         text,
  last_name          text,
  company_name       text,
  emails             jsonb not null default '[]'::jsonb,
  phones             jsonb not null default '[]'::jsonb,
  balance_cents      integer,
  is_archived        boolean not null default false,
  jobber_created_at  timestamptz,
  jobber_updated_at  timestamptz,
  raw                jsonb,
  synced_at          timestamptz not null default now()
);
create index if not exists jobber_clients_account_idx on public.jobber_clients(jobber_account_id);
create index if not exists jobber_clients_name_idx on public.jobber_clients
  using gin (to_tsvector('simple', coalesce(company_name,'') || ' ' || coalesce(first_name,'') || ' ' || coalesce(last_name,'')));

-- Mirror of Jobber visits (today's-feed primary source).
create table if not exists public.jobber_visits (
  id                 text primary key,
  jobber_account_id  text not null references public.jobber_oauth_tokens(jobber_account_id) on delete cascade,
  job_id             text,
  client_id          text,
  property_id        text,
  title              text,
  starts_at          timestamptz,
  ends_at            timestamptz,
  is_complete        boolean not null default false,
  assigned_user_ids  text[] not null default '{}',
  raw                jsonb,
  synced_at          timestamptz not null default now()
);
create index if not exists jobber_visits_account_idx  on public.jobber_visits(jobber_account_id);
create index if not exists jobber_visits_starts_idx   on public.jobber_visits(starts_at);
create index if not exists jobber_visits_client_idx   on public.jobber_visits(client_id);

-- Append-only audit log of every webhook delivery.
create table if not exists public.jobber_webhook_events (
  id                 uuid primary key default gen_random_uuid(),
  jobber_account_id  text,
  topic              text not null,
  item_id            text,
  received_at        timestamptz not null default now(),
  hmac_valid         boolean not null,
  processed_at       timestamptz,
  process_error      text,
  raw                jsonb not null
);
create index if not exists jobber_webhook_events_received_idx on public.jobber_webhook_events(received_at desc);
create index if not exists jobber_webhook_events_topic_idx    on public.jobber_webhook_events(topic);

-- RLS: lock down by default; service role bypasses.
alter table public.jobber_oauth_tokens   enable row level security;
alter table public.jobber_clients        enable row level security;
alter table public.jobber_visits         enable row level security;
alter table public.jobber_webhook_events enable row level security;

-- Read access for authenticated users — Jobber data is internal-only, all
-- staff with an OS account can see it. Tighten later if needed.
drop policy if exists "jobber_clients read"   on public.jobber_clients;
create policy "jobber_clients read"
  on public.jobber_clients for select
  to authenticated using (true);

drop policy if exists "jobber_visits read"    on public.jobber_visits;
create policy "jobber_visits read"
  on public.jobber_visits for select
  to authenticated using (true);
