-- TexasTurf OS — Reviews & reputation engine (Marketing phase N4)
-- Spec: docs/superpowers/specs/2026-06-10-marketing-section-design.md
-- Track which completed jobs to ask for a review, where the review landed,
-- and response-rate counts. Asks are sent via Jobber/text; this is the record.

do $$ begin
  create type public.review_status as enum ('pending', 'requested', 'received', 'declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_platform as enum ('google', 'facebook', 'jobber', 'other');
exception when duplicate_object then null; end $$;

-- jobber_job_id has NO foreign key (jobber_jobs is a sync-owned mirror); we
-- snapshot the fields the asker needs at list-build time.
create table if not exists public.review_outreach (
  id                uuid primary key default gen_random_uuid(),
  jobber_job_id     text not null,
  jobber_client_id  text,
  client_name       text not null,
  client_phone      text,
  client_email      text,
  job_title         text,
  completed_on      date,
  status            public.review_status not null default 'pending',
  platform          public.review_platform,
  owner_id          uuid references public.profiles(id) on delete set null,
  requested_at      timestamptz,
  received_at       timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (jobber_job_id)
);

create index if not exists review_outreach_status_idx on public.review_outreach (status);
create index if not exists review_outreach_completed_idx on public.review_outreach (completed_on);

drop trigger if exists touch_review_outreach on public.review_outreach;
create trigger touch_review_outreach before update on public.review_outreach
  for each row execute function public.touch_updated_at();

alter table public.review_outreach enable row level security;

drop policy if exists "review_outreach select" on public.review_outreach;
create policy "review_outreach select" on public.review_outreach
  for select to authenticated using (true);
drop policy if exists "review_outreach marketing write" on public.review_outreach;
create policy "review_outreach marketing write" on public.review_outreach
  for all to authenticated
  using (public.user_is_marketing()) with check (public.user_is_marketing());

-- CLI bookkeeping (applied via Management API)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text
);
insert into supabase_migrations.schema_migrations (version, name)
values ('20260610220000', 'marketing_reviews')
on conflict (version) do nothing;
