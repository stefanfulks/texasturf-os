-- Pitch: in-app sales deck foundation.
-- pitch_tiers = admin-configured Silver/Gold/Platinum config (product + margin + inclusions + warranty).
-- pitch_sessions = one on-site presentation with a CLIENT-SAFE price snapshot.
-- Adds inv_products.pricing_key so a featured inventory product resolves its pricing-catalog cost key.
-- Idempotent — safe to re-run.

-- Link inventory products to the pricing catalog (src/lib/pricing/data.ts keys)
do $$ begin
  alter table public.inv_products add column pricing_key text;
exception when duplicate_column then null; end $$;

create table if not exists public.pitch_tiers (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,            -- 'silver' | 'gold' | 'platinum'
  name          text not null,
  sort          integer not null default 0,
  inv_product_id uuid references public.inv_products(id) on delete set null,
  product_label text not null,                   -- client-facing product name
  pricing_key   text not null,                   -- cost key into pricing/data.ts
  target_margin numeric not null default 50,
  infill_mode   text not null default 'standard',-- 'standard' | 'none'
  inclusions    jsonb not null default '[]'::jsonb,
  warranty      jsonb not null default '{"residential_years":15,"commercial_years":8,"prorated":true}'::jsonb,
  is_active     boolean not null default true,
  updated_by    uuid references auth.users(id),
  updated_at    timestamptz not null default now()
);

create table if not exists public.pitch_sessions (
  id             uuid primary key default gen_random_uuid(),
  prospect_name  text,
  address        text,
  base_job       jsonb not null,                 -- {installedSqft, application, tearoutTier, access}
  tier_snapshot  jsonb not null default '[]'::jsonb,  -- resolved tiers at pitch time
  quote_snapshot jsonb not null default '[]'::jsonb,  -- CLIENT-SAFE ClientPrice[]
  selected_tier  text,
  status         text not null default 'draft',  -- draft|presented|accepted|lost
  deal_id        uuid references public.deals(id) on delete set null,
  client_id      text references public.jobber_clients(id) on delete set null,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  presented_at   timestamptz,
  decided_at     timestamptz
);

create index if not exists pitch_sessions_created_idx on public.pitch_sessions(created_at desc);

alter table public.pitch_tiers    enable row level security;
alter table public.pitch_sessions enable row level security;

-- Sessions: any authenticated user (internal team tool — mirrors deals access).
drop policy if exists pitch_sessions_authd on public.pitch_sessions;
create policy pitch_sessions_authd on public.pitch_sessions for all to authenticated using (true) with check (true);

-- Tiers: everyone reads; only admins write.
drop policy if exists pitch_tiers_read        on public.pitch_tiers;
drop policy if exists pitch_tiers_admin_write on public.pitch_tiers;
create policy pitch_tiers_read on public.pitch_tiers for select to authenticated using (true);
create policy pitch_tiers_admin_write on public.pitch_tiers for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Seed the three tiers (only if none exist).
insert into public.pitch_tiers (key, name, sort, product_label, pricing_key, target_margin, infill_mode, inclusions, warranty)
select * from (values
  ('silver',   'Silver',   1, 'TexasPlay',  'TexasPlay',  50::numeric, 'standard',
     '["Professional site prep & weed barrier","Compacted base","Infill turf — pet & kid friendly","Expert install crew","15-yr residential / 8-yr commercial pro-rated warranty"]'::jsonb,
     '{"residential_years":15,"commercial_years":8,"prorated":true}'::jsonb),
  ('gold',     'Gold',     2, 'Royal 40',   'Royal 40',   50::numeric, 'standard',
     '["Everything in Silver","Realistic multi-tone blade","Heat-resistant infill","Premium edging","15-yr residential / 8-yr commercial pro-rated warranty"]'::jsonb,
     '{"residential_years":15,"commercial_years":8,"prorated":true}'::jsonb),
  ('platinum', 'Platinum', 3, 'Majestic 70','Majestic 70',50::numeric, 'none',
     '["Everything in Gold","Netherlands-sourced premium turf","Zero infill — clean, no displacement","Most realistic look & feel","15-yr residential / 8-yr commercial NON-pro-rated warranty"]'::jsonb,
     '{"residential_years":15,"commercial_years":8,"prorated":false}'::jsonb)
) as v(key, name, sort, product_label, pricing_key, target_margin, infill_mode, inclusions, warranty)
where not exists (select 1 from public.pitch_tiers);
