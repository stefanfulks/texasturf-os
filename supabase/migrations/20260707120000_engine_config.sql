-- Engine config — moves pricing/commission/capacity business assumptions out of
-- code and into admin-editable tables. Additive only. Seeds mirror the exact
-- hardcoded values in src/lib/pricing/data.ts so behavior is unchanged until
-- ownership edits them.
--
-- RLS model: the quote flow runs for sales/office users, so CONFIG tables are
-- readable by all authenticated users (they already ship to every browser in
-- the JS bundle today) and writable by admin only. fin_product + fin_cost_rate
-- gain an authenticated-READ policy alongside their existing admin-all policy.

-- ── Commission tiers (rate looked up from GP%, paid on gross-margin $) ───────
create table if not exists public.fin_commission_tier (
  id              uuid primary key default gen_random_uuid(),
  min_margin_pct  numeric(6,2) not null,
  max_margin_pct  numeric(6,2),            -- null = uncapped; matching is half-open [min, max)
  rate_pct        numeric(6,3) not null default 0,  -- 4 = 4% of gross margin $
  requires_review boolean not null default false,
  label           text,
  sort_order      int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Mileage bands (travel cost) — seeded EMPTY; ownership inputs values ──────
create table if not exists public.fin_mileage_band (
  id             uuid primary key default gen_random_uuid(),
  min_miles      numeric(8,1) not null default 0,
  max_miles      numeric(8,1),              -- null = uncapped; half-open [min, max)
  flat_cost      numeric(10,2) not null default 0,
  cost_per_mile  numeric(10,4) not null default 0,
  label          text,
  sort_order     int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Capacity + engine mode knobs on company settings (admin-only table) ──────
alter table public.fin_company_settings
  add column if not exists labor_model          text not null default 'subcontract',  -- 'subcontract' | 'burdened'
  add column if not exists overhead_mode        text not null default 'live',         -- 'live' | 'pinned'
  add column if not exists overhead_pinned_rate numeric(10,4) not null default 0,
  add column if not exists crew_count           int  not null default 0,              -- 0 = not configured
  add column if not exists sqft_per_crew_day    numeric(10,2) not null default 0;     -- 0 = not configured

-- ── updated_at triggers (reuse fin_set_updated_at from the foundation) ───────
drop trigger if exists fin_commission_tier_set_updated_at on public.fin_commission_tier;
create trigger fin_commission_tier_set_updated_at before update on public.fin_commission_tier
  for each row execute function public.fin_set_updated_at();
drop trigger if exists fin_mileage_band_set_updated_at on public.fin_mileage_band;
create trigger fin_mileage_band_set_updated_at before update on public.fin_mileage_band
  for each row execute function public.fin_set_updated_at();

-- ── RLS: authenticated READ + admin WRITE on the two new config tables ───────
do $$
declare t text;
begin
  foreach t in array array['fin_commission_tier','fin_mileage_band']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_auth_read on public.%I;', t, t);
    execute format('create policy %I_auth_read on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I;', t, t);
    execute format($f$create policy %I_admin_write on public.%I for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));$f$, t, t);
  end loop;
end $$;

-- ── fin_product + fin_cost_rate become team-readable (write stays admin) ─────
drop policy if exists fin_product_auth_read on public.fin_product;
create policy fin_product_auth_read on public.fin_product
  for select to authenticated using (true);
drop policy if exists fin_cost_rate_auth_read on public.fin_cost_rate;
create policy fin_cost_rate_auth_read on public.fin_cost_rate
  for select to authenticated using (true);

-- ── Seed: commission tiers (mirror current hardcoded behavior exactly) ───────
insert into public.fin_commission_tier (min_margin_pct, max_margin_pct, rate_pct, requires_review, label, sort_order)
select v.min_m, v.max_m, v.rate, v.review, v.label, v.sort
from (values
  (0::numeric,  40::numeric, 0::numeric, true,  'Below quote floor — manager review', 0),
  (40::numeric, 50::numeric, 4::numeric, false, '4% of GP',                            1),
  (50::numeric, 60::numeric, 6::numeric, false, '6% of GP',                            2),
  (60::numeric, null,        8::numeric, false, '8% of GP',                            3)
) as v(min_m, max_m, rate, review, label, sort)
where not exists (select 1 from public.fin_commission_tier);

-- ── Seed: scalar engine knobs into fin_cost_rate (FY2026) ────────────────────
insert into public.fin_cost_rate (key, value, unit, effective_fiscal_year)
values
  ('waste_standard_pct',            10,   '%',      2026),
  ('waste_putting_green_pct',       20,   '%',      2026),
  ('labor_soil_standard_per_sqft',  1.60, '$/sqft', 2026),
  ('labor_soil_small_per_sqft',     1.90, '$/sqft', 2026),
  ('labor_putting_green_per_sqft',  2.00, '$/sqft', 2026),
  ('labor_concrete_per_sqft',       1.10, '$/sqft', 2026),
  ('small_job_sqft_threshold',      600,  'sqft',   2026),
  ('min_margin_for_quote_pct',      40,   '%',      2026)
on conflict (key, effective_fiscal_year) do nothing;

-- ── Seed: the 11 turf products into fin_product (material cost source) ───────
insert into public.fin_product (name, category, raw_cost_per_sqft, roll_size, infill_type)
select v.name, v.category, v.cost, v.roll_size, v.infill_type
from (values
  ('TexasMoss',               'landscape',     1.32::numeric, '15x100', 'standard'),
  ('TexasLush',               'landscape',     0.89::numeric, '15x100', 'standard'),
  ('TexasPlay',               'landscape',     0.76::numeric, '15x100', 'standard'),
  ('TexasHaven',              'landscape',     0.75::numeric, '15x100', 'standard'),
  ('Royal 40',                'landscape',     2.15::numeric, '13x100', 'agl'),
  ('Saratoga 40',             'landscape',     2.18::numeric, '13x100', 'agl'),
  ('Saratoga 60',             'landscape',     2.53::numeric, '13x100', 'agl'),
  ('Kent 44',                 'landscape',     2.53::numeric, '13x100', 'agl'),
  ('Monte Carlo 60',          'landscape',     2.38::numeric, '13x100', 'agl'),
  ('Majestic 70',             'landscape',     3.30::numeric, '13x100', 'agl'),
  ('TexasPutt (pro putt 44)', 'putting_green', 2.29::numeric, '15x100', 'sand_only')
) as v(name, category, cost, roll_size, infill_type)
where not exists (select 1 from public.fin_product fp where fp.name = v.name);
