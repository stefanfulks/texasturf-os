-- Sales module: pipeline that lives upstream of Jobber.
-- sales_contacts = prospects not yet in Jobber; deals = pipeline; deal_activities = timeline (+ comms landing zone).

create table if not exists public.sales_contacts (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  company          text,
  email            text,
  phone            text,
  segment          text,
  city             text,
  source           text,
  notes            text,
  jobber_client_id text references public.jobber_clients(id) on delete set null,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.deals (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  stage               text not null default 'lead',
  value_usd           numeric,
  service_line        text,
  sqft                integer,
  expected_close_date date,
  next_step           text,
  next_step_date      date,
  notes               text,
  stage_tasks         jsonb not null default '{}'::jsonb,
  owner_id            uuid references auth.users(id),
  sales_contact_id    uuid references public.sales_contacts(id) on delete set null,
  jobber_client_id    text references public.jobber_clients(id) on delete set null,
  stage_entered_at    timestamptz not null default now(),
  closed_at           timestamptz,
  lost_reason         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint deals_has_party check (sales_contact_id is not null or jobber_client_id is not null)
);

create table if not exists public.deal_activities (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  kind        text not null,
  body        text,
  direction   text,
  metadata    jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create index if not exists deals_stage_idx           on public.deals(stage);
create index if not exists deals_owner_idx           on public.deals(owner_id);
create index if not exists deals_close_idx           on public.deals(expected_close_date);
create index if not exists deal_activities_deal_idx  on public.deal_activities(deal_id, occurred_at desc);
create index if not exists sales_contacts_jobber_idx on public.sales_contacts(jobber_client_id);

alter table public.sales_contacts  enable row level security;
alter table public.deals           enable row level security;
alter table public.deal_activities enable row level security;

-- Internal team tool: any authenticated user has full access (mirrors jobber_clients access model).
-- drop-then-create keeps the migration idempotent (CREATE POLICY has no IF NOT EXISTS).
drop policy if exists sales_contacts_authd  on public.sales_contacts;
drop policy if exists deals_authd           on public.deals;
drop policy if exists deal_activities_authd on public.deal_activities;
create policy sales_contacts_authd  on public.sales_contacts  for all to authenticated using (true) with check (true);
create policy deals_authd           on public.deals           for all to authenticated using (true) with check (true);
create policy deal_activities_authd on public.deal_activities for all to authenticated using (true) with check (true);
