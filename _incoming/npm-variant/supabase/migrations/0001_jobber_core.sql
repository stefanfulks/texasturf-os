-- TexasTurf Command Center: Jobber integration core tables.
-- Run with `supabase db push` or paste into Supabase SQL editor.

create extension if not exists pgcrypto;

-- One Jobber account installs the app; tokens are stored per Jobber account id.
create table if not exists jobber_oauth_tokens (
  jobber_account_id text primary key,
  access_token       text        not null,
  refresh_token      text        not null,
  expires_at         timestamptz not null,
  scopes             text[]      not null default '{}',
  installed_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Mirror of Jobber clients. id is the Jobber Encoded ID.
create table if not exists jobber_clients (
  id                 text primary key,
  jobber_account_id  text not null references jobber_oauth_tokens(jobber_account_id) on delete cascade,
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
create index if not exists jobber_clients_account_idx on jobber_clients(jobber_account_id);
create index if not exists jobber_clients_name_idx on jobber_clients
  using gin (to_tsvector('simple', coalesce(company_name,'') || ' ' || coalesce(first_name,'') || ' ' || coalesce(last_name,'')));

-- Mirror of Jobber visits (today's-feed primary source).
create table if not exists jobber_visits (
  id                 text primary key,
  jobber_account_id  text not null references jobber_oauth_tokens(jobber_account_id) on delete cascade,
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
create index if not exists jobber_visits_account_idx  on jobber_visits(jobber_account_id);
create index if not exists jobber_visits_starts_idx   on jobber_visits(starts_at);
create index if not exists jobber_visits_client_idx   on jobber_visits(client_id);

-- Append-only audit log of every webhook delivery.
create table if not exists jobber_webhook_events (
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
create index if not exists jobber_webhook_events_received_idx on jobber_webhook_events(received_at desc);
create index if not exists jobber_webhook_events_topic_idx    on jobber_webhook_events(topic);

-- RLS: lock down by default; service role bypasses, browser anon gets nothing
-- until we wire Supabase Auth. Open up with per-row policies later.
alter table jobber_oauth_tokens   enable row level security;
alter table jobber_clients        enable row level security;
alter table jobber_visits         enable row level security;
alter table jobber_webhook_events enable row level security;
