-- Marketing OS rebuild — increment 1: data-model foundations. Additive only.
--
-- Adds the fields the execution-layer rebuild needs:
--   campaigns      → ownership + objective/audience/offer + next_action
--   content_items  → kanban sort order, campaign link, platform/caption/CTA,
--                    production dates, publish URL, asset links, AI flag
--   marketing_ai_generations   → audit log of every AI generation
--   marketing_business_inputs  → owner-supplied numbers (amber-until-filled;
--                                NEVER invented by AI), seeded with the Ads
--                                framework's required inputs, values null.

-- ── campaigns: ownership + brief structure + next action ─────────────────────
alter table public.campaigns
  add column if not exists owner_id    uuid references public.profiles(id) on delete set null,
  add column if not exists objective   text,
  add column if not exists audience    text,
  add column if not exists offer       text,
  add column if not exists next_action text,
  add column if not exists notes       text;

-- ── content_items: production board v2 fields ────────────────────────────────
alter table public.content_items
  add column if not exists campaign_id      uuid references public.campaigns(id) on delete set null,
  add column if not exists sort_order       int not null default 0,
  add column if not exists platform         text,
  add column if not exists caption          text,
  add column if not exists cta              text,
  add column if not exists editing_notes    text,
  add column if not exists publishing_notes text,
  add column if not exists asset_links      jsonb not null default '[]'::jsonb,
  add column if not exists due_date         date,
  add column if not exists shoot_date       date,
  add column if not exists published_url    text,
  add column if not exists is_ai_generated  boolean not null default false;

create index if not exists content_items_campaign_idx
  on public.content_items (campaign_id) where campaign_id is not null;
create index if not exists content_items_status_sort_idx
  on public.content_items (status, sort_order);

-- ── marketing_ai_generations: audit log for every AI generation ──────────────
create table if not exists public.marketing_ai_generations (
  id               uuid primary key default gen_random_uuid(),
  section          text not null,             -- 'content' | 'campaigns' | 'ads' | 'referrals' | 'reviews' | 'playbook'
  generation_type  text not null,             -- e.g. 'content_card', 'ad_creative', 'campaign_brief'
  input            jsonb not null default '{}'::jsonb,
  output           jsonb not null default '{}'::jsonb,
  linked_table     text,
  linked_record_id uuid,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists marketing_ai_generations_section_idx
  on public.marketing_ai_generations (section, created_at desc);

alter table public.marketing_ai_generations enable row level security;

drop policy if exists "mkt_ai_gen select" on public.marketing_ai_generations;
create policy "mkt_ai_gen select" on public.marketing_ai_generations
  for select to authenticated using (true);
drop policy if exists "mkt_ai_gen marketing write" on public.marketing_ai_generations;
create policy "mkt_ai_gen marketing write" on public.marketing_ai_generations
  for all to authenticated
  using (public.user_is_marketing()) with check (public.user_is_marketing());

-- ── marketing_business_inputs: owner-supplied numbers, amber until filled ────
create table if not exists public.marketing_business_inputs (
  id          uuid primary key default gen_random_uuid(),
  input_key   text not null unique,
  label       text not null,
  section     text not null default 'ads',
  input_type  text not null default 'text',   -- 'text' | 'number' | 'date'
  required    boolean not null default true,
  value       text,                           -- null = not provided yet (amber)
  notes       text,
  sort_order  int not null default 0,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.marketing_business_inputs enable row level security;

drop policy if exists "mkt_inputs select" on public.marketing_business_inputs;
create policy "mkt_inputs select" on public.marketing_business_inputs
  for select to authenticated using (true);
-- Business inputs are real company numbers — admin-only writes.
drop policy if exists "mkt_inputs admin write" on public.marketing_business_inputs;
create policy "mkt_inputs admin write" on public.marketing_business_inputs
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Seed the Ads framework's owner inputs (values intentionally NULL — the UI
-- shows them amber until Stefan fills them in; AI never invents them).
insert into public.marketing_business_inputs (input_key, label, section, input_type, sort_order)
values
  ('service_radius_miles',      'Service radius (miles from HQ)',            'ads', 'number', 0),
  ('review_count',              'Real 5-star review count',                  'ads', 'number', 1),
  ('install_count',             'Real completed install count',              'ads', 'number', 2),
  ('discount_amount',           'Current discount offer ($ off per product)','ads', 'text',   3),
  ('avg_gross_profit_install',  'Average gross profit per install ($)',      'ads', 'number', 4),
  ('close_rate_pct',            'Lead → sale close rate (%)',                'ads', 'number', 5),
  ('target_cpl',                'Target cost per lead ($)',                  'ads', 'number', 6),
  ('avg_ticket',                'Average ticket ($)',                        'ads', 'number', 7),
  ('financing_offer',           'Available financing offer (e.g. Wisestack terms)', 'ads', 'text', 8),
  ('install_lead_time',         'Current installation lead time',            'ads', 'text',   9),
  ('install_capacity',          'Available install capacity (jobs/week)',    'ads', 'text',   10),
  ('priority_service_lines',    'Best service lines to push right now',      'ads', 'text',   11),
  ('seasonal_priority',         'Current seasonal priority',                 'ads', 'text',   12),
  ('proof_points',              'Real testimonial / proof points',           'ads', 'text',   13),
  ('offer_expiration',          'Current offer expiration date',             'ads', 'text',   14),
  ('monthly_ad_budget',         'Starting monthly ad budget ($)',            'ads', 'number', 15)
on conflict (input_key) do nothing;

-- updated_at touch trigger (reuse the shared helper)
drop trigger if exists touch_marketing_business_inputs on public.marketing_business_inputs;
create trigger touch_marketing_business_inputs before update on public.marketing_business_inputs
  for each row execute function public.touch_updated_at();
