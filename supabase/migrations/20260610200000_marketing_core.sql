-- TexasTurf OS — Marketing core (Phase 1 of marketing section)
-- Spec: docs/superpowers/specs/2026-06-10-marketing-section-design.md
-- campaigns + referral_outreach (call roster) + referrals (ledger) + content_items.
-- content_items ships now (schema complete); its UI arrives in Phase 2.

-- ─── Enums ───────────────────────────────────────────────────────────────────

do $$ begin
  create type public.campaign_type as enum
    ('referral', 'service_spotlight', 'seasonal', 'event', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum
    ('draft', 'active', 'paused', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.outreach_segment as enum ('residential', 'b2b_partner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.outreach_call_status as enum
    ('queued', 'no_answer', 'declined', 'referred', 'do_not_call', 'invalid_number');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.referral_source as enum
    ('call', 'jobber_link', 'word_of_mouth', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.referral_stage as enum
    ('lead', 'contacted', 'quoted', 'signed', 'completed_paid', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.referral_reward_type as enum
    ('visa_250', 'care_plan_1yr', 'undecided');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.referral_reward_status as enum ('not_earned', 'due', 'sent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_item_type as enum
    ('long_video', 'short', 'pov_clip', 'before_after', 'photo_set', 'blog_post', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_item_status as enum
    ('idea', 'scripted', 'scheduled_shoot', 'filmed', 'editing', 'ready', 'published', 'archived');
exception when duplicate_object then null; end $$;

-- ─── Access helper ───────────────────────────────────────────────────────────

create or replace function public.user_is_marketing()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.current_role() = 'admin'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and 'marketing' = any(p.departments)
    );
$$;

-- ─── campaigns ───────────────────────────────────────────────────────────────

create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  type          public.campaign_type   not null default 'other',
  status        public.campaign_status not null default 'draft',
  brief_md      text,
  -- [{label, subject, body}] — copy blocks pasted into Jobber manually.
  jobber_copy   jsonb not null default '[]'::jsonb,
  -- [{channel, planned_on, done_at}] — manual channel checklist.
  channels      jsonb not null default '[]'::jsonb,
  service_line  text,
  starts_on     date,
  ends_on       date,
  results       jsonb not null default '{}'::jsonb,
  created_by_id uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists campaigns_status_idx on public.campaigns (status);

drop trigger if exists touch_campaigns on public.campaigns;
create trigger touch_campaigns before update on public.campaigns
  for each row execute function public.touch_updated_at();

-- ─── referral_outreach (call roster) ─────────────────────────────────────────
-- jobber_client_id intentionally has NO foreign key: jobber_clients is a
-- sync-owned mirror (rows may be re-written by sync). We snapshot the fields
-- the callers need at roster-build time.

create table if not exists public.referral_outreach (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.campaigns(id) on delete cascade,
  jobber_client_id  text not null,
  client_name       text not null,
  client_phone      text,
  client_email      text,
  last_job_note     text,
  segment           public.outreach_segment     not null default 'residential',
  owner_id          uuid references public.profiles(id) on delete set null,
  call_status       public.outreach_call_status not null default 'queued',
  attempts          int  not null default 0,
  last_called_at    timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (campaign_id, jobber_client_id)
);

create index if not exists referral_outreach_campaign_status_idx
  on public.referral_outreach (campaign_id, call_status);
create index if not exists referral_outreach_owner_idx
  on public.referral_outreach (owner_id) where owner_id is not null;

drop trigger if exists touch_referral_outreach on public.referral_outreach;
create trigger touch_referral_outreach before update on public.referral_outreach
  for each row execute function public.touch_updated_at();

-- ─── referrals (ledger) ──────────────────────────────────────────────────────

create table if not exists public.referrals (
  id                         uuid primary key default gen_random_uuid(),
  campaign_id                uuid references public.campaigns(id) on delete set null,
  outreach_id                uuid references public.referral_outreach(id) on delete set null,
  referrer_jobber_client_id  text,
  referrer_name              text not null,
  source                     public.referral_source not null default 'call',
  referred_name              text not null,
  referred_phone             text,
  referred_email             text,
  service_interest           text,
  stage                      public.referral_stage         not null default 'lead',
  reward_type                public.referral_reward_type   not null default 'undecided',
  reward_status              public.referral_reward_status not null default 'not_earned',
  reward_sent_at             timestamptz,
  reward_note                text,
  jobber_quote_url           text,
  jobber_job_url             text,
  notes                      text,
  created_by_id              uuid references public.profiles(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists referrals_stage_idx  on public.referrals (stage);
create index if not exists referrals_reward_idx on public.referrals (reward_status);
create index if not exists referrals_campaign_idx
  on public.referrals (campaign_id) where campaign_id is not null;

drop trigger if exists touch_referrals on public.referrals;
create trigger touch_referrals before update on public.referrals
  for each row execute function public.touch_updated_at();

-- ─── content_items (schema now, UI in Phase 2) ───────────────────────────────

create table if not exists public.content_items (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  type               public.content_item_type   not null default 'other',
  status             public.content_item_status not null default 'idea',
  service_line       text,
  creator_id         uuid references public.profiles(id) on delete set null,
  drive_url          text,
  youtube_url        text,
  published_channels jsonb not null default '[]'::jsonb,
  hook               text,
  job_ref            text,
  shot_on            date,
  published_on       date,
  created_by_id      uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists content_items_status_idx on public.content_items (status);
create index if not exists content_items_service_idx
  on public.content_items (service_line) where service_line is not null;

drop trigger if exists touch_content_items on public.content_items;
create trigger touch_content_items before update on public.content_items
  for each row execute function public.touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Reads: any authenticated user (internal ops data, not client-sensitive).
-- Writes: admin or marketing department, via user_is_marketing().

alter table public.campaigns         enable row level security;
alter table public.referral_outreach enable row level security;
alter table public.referrals         enable row level security;
alter table public.content_items     enable row level security;

drop policy if exists "campaigns select" on public.campaigns;
create policy "campaigns select" on public.campaigns
  for select to authenticated using (true);
drop policy if exists "campaigns marketing write" on public.campaigns;
create policy "campaigns marketing write" on public.campaigns
  for all to authenticated
  using (public.user_is_marketing()) with check (public.user_is_marketing());

drop policy if exists "referral_outreach select" on public.referral_outreach;
create policy "referral_outreach select" on public.referral_outreach
  for select to authenticated using (true);
drop policy if exists "referral_outreach marketing write" on public.referral_outreach;
create policy "referral_outreach marketing write" on public.referral_outreach
  for all to authenticated
  using (public.user_is_marketing()) with check (public.user_is_marketing());

drop policy if exists "referrals select" on public.referrals;
create policy "referrals select" on public.referrals
  for select to authenticated using (true);
drop policy if exists "referrals marketing write" on public.referrals;
create policy "referrals marketing write" on public.referrals
  for all to authenticated
  using (public.user_is_marketing()) with check (public.user_is_marketing());

drop policy if exists "content_items select" on public.content_items;
create policy "content_items select" on public.content_items
  for select to authenticated using (true);
drop policy if exists "content_items marketing write" on public.content_items;
create policy "content_items marketing write" on public.content_items
  for all to authenticated
  using (public.user_is_marketing()) with check (public.user_is_marketing());

-- ─── Seed: Referral Thank-You Blitz 2026 ─────────────────────────────────────

insert into public.campaigns (slug, name, type, status, starts_on, brief_md, jobber_copy)
values (
  'referral-blitz-2026',
  'Referral Thank-You Blitz 2026',
  'referral',
  'active',
  '2026-06-15',
  $md$## The offer
Refer someone who becomes a completed, paid TexasTurf project. Choose **$250 Visa gift card** or **1 year of the TexasTurf Care Plan free**. The referred friend gets **$100 off** their project. Reward is earned when the referred job is **completed and the final invoice is paid**. Unlimited referrals; offer never expires. Never the word "insurance" in writing.

## The motion
1. Roster built in this app from synced Jobber clients (completed job + phone).
2. Export CSV -> Reevo list -> Power Dialer sequence (2 attempts max: call -> text -> call in 5 days).
3. Log every outcome here (<=10s per call). "Referred" captures name + phone + interest.
4. Ledger tracks each referral: lead -> quoted -> signed -> completed_paid -> reward sent.
5. Air cover: Jobber announcement email the week calls start (copy below).

## Call opener
"Hey [first name]! This is [caller] with TexasTurf — we did your backyard over on [street] back in [season]. How's it holding up? ... Love to hear it. So the reason I'm calling — we're growing this year mostly through our past clients instead of spending it all on ads. We'd rather pay you than Facebook. If you know anyone wanting turf, a patio, a pickleball court — anything outdoor — and they complete a project with us, you get a $250 Visa gift card or a full year of our Care Plan free. Who comes to mind?"

Full script + objection handling: spec section 3.4 (docs/superpowers/specs/2026-06-10-marketing-section-design.md).$md$,
  '[
    {"label":"Announcement email (Jobber Campaigns)","subject":"We''d rather pay you than Facebook","body":"We''re growing through the people who already trust us — our past clients. Refer a friend with any outdoor project (turf, pavers, courts, fencing, concrete, full landscapes). When their project completes: you get $250 or a free year of the TexasTurf Care Plan, and they get $100 off. Reply to this email or text us with a name. — Stefan & the TexasTurf crew"},
    {"label":"Follow-up text (Reevo)","subject":"","body":"Hi [name], it''s [caller] from TexasTurf. Quick recap: know anyone wanting turf, pavers, a sport court, fencing — any outdoor project? When they complete a project with us you get a $250 Visa gift card (or a free year of our Care Plan), and they get $100 off. Just reply with a name & number anytime — this never expires."},
    {"label":"Reward-sent thank-you (Jobber)","subject":"Your $250 is on its way","body":"Thank you for trusting us with your people — that means everything to a crew like ours. Your reward is on its way. Anyone else comes to mind, the offer never expires."}
  ]'::jsonb
)
on conflict (slug) do nothing;

-- ─── CLI bookkeeping ─────────────────────────────────────────────────────────
-- If this file is applied via the dashboard SQL editor (per supabase/README.md),
-- record it so a future `supabase db push` doesn't re-apply it.

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name)
values ('20260610200000', 'marketing_core')
on conflict (version) do nothing;
