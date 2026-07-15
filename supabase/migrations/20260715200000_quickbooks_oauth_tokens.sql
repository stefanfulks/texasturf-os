-- QuickBooks Online OAuth token storage. Additive.
-- One QuickBooks company (realmId) installs the app; tokens are stored per realm.
-- Refresh tokens rotate on every refresh and expire after ~100 days of inactivity,
-- so updated_at is the freshness signal worth watching.
--
-- RLS is enabled with NO policies: only the service-role client (the sync's
-- trusted server path) can touch tokens. They never reach a user-context query.

create table if not exists public.quickbooks_oauth_tokens (
  realm_id           text primary key,
  environment        text        not null check (environment in ('sandbox','production')),
  access_token       text        not null,
  refresh_token      text        not null,
  expires_at         timestamptz not null,
  refresh_expires_at timestamptz not null,
  scopes             text[]      not null default '{}',
  installed_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.quickbooks_oauth_tokens enable row level security;
