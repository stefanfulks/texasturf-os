-- TurfCasa quoting foundation — additive only.
--
-- The outlet's own customer-side records, modeled on the parts of Jobber
-- TexasTurf actually uses (statuses, deposits, negative-line discounts,
-- default 8.25% tax) plus the one thing Jobber can't do: a trade AND retail
-- price on every catalog SKU.
--
--   turfcasa_accounts     → trade accounts + retail walk-ins
--   turfcasa_products     → catalog (trade/retail price, taxable, unit)
--   turfcasa_quotes       → quote header (status lifecycle, deposit, tax)
--   turfcasa_quote_lines  → line items (negative unit_price = discount line)

-- ── accounts ─────────────────────────────────────────────────────────────────
create table if not exists public.turfcasa_accounts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  is_company    boolean not null default false,
  contact_name  text,
  email         text,
  phone         text,
  account_type  text not null default 'trade'
                check (account_type in ('trade', 'retail')),
  pricing_tier  int not null default 1 check (pricing_tier between 1 and 3),
  terms         text not null default 'due_on_receipt'
                check (terms in ('due_on_receipt', 'net30')),
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists turfcasa_accounts_name_idx
  on public.turfcasa_accounts (lower(name));

alter table public.turfcasa_accounts enable row level security;

drop policy if exists "tc_accounts select" on public.turfcasa_accounts;
create policy "tc_accounts select" on public.turfcasa_accounts
  for select to authenticated using (true);
drop policy if exists "tc_accounts write" on public.turfcasa_accounts;
create policy "tc_accounts write" on public.turfcasa_accounts
  for all to authenticated using (true) with check (true);

-- ── products (catalog) ───────────────────────────────────────────────────────
create table if not exists public.turfcasa_products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  category      text not null default 'other'
                check (category in ('turf', 'pet_turf', 'putting_green', 'infill',
                                    'fastener', 'adhesive', 'edging', 'ground_prep',
                                    'tool', 'other')),
  unit          text not null default 'sqft'
                check (unit in ('sqft', 'linear_ft', 'each', 'box', 'bag', 'roll', 'pallet')),
  retail_price  numeric(12, 2),
  trade_price   numeric(12, 2),
  unit_cost     numeric(12, 2),
  taxable       boolean not null default true,
  visible       boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.turfcasa_products enable row level security;

drop policy if exists "tc_products select" on public.turfcasa_products;
create policy "tc_products select" on public.turfcasa_products
  for select to authenticated using (true);
-- Pricing is an owner decision (JD guardrail: Stefan approves tier changes).
drop policy if exists "tc_products admin write" on public.turfcasa_products;
create policy "tc_products admin write" on public.turfcasa_products
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── quotes ───────────────────────────────────────────────────────────────────
create sequence if not exists public.turfcasa_quote_number_seq start 1001;

create table if not exists public.turfcasa_quotes (
  id              uuid primary key default gen_random_uuid(),
  quote_number    bigint not null unique
                  default nextval('public.turfcasa_quote_number_seq'),
  account_id      uuid not null references public.turfcasa_accounts(id) on delete restrict,
  title           text,
  status          text not null default 'draft'
                  check (status in ('draft', 'sent', 'approved', 'converted',
                                    'archived', 'changes_requested')),
  deposit_type    text not null default 'percent'
                  check (deposit_type in ('none', 'percent', 'fixed')),
  deposit_value   numeric(12, 2) not null default 50,
  tax_rate        numeric(6, 3) not null default 8.25,
  -- Totals are a stored snapshot, recomputed by the server action on every
  -- line change — keeps list pages one query with no drift risk in practice.
  subtotal        numeric(12, 2) not null default 0,
  tax_total       numeric(12, 2) not null default 0,
  total           numeric(12, 2) not null default 0,
  deposit_amount  numeric(12, 2) not null default 0,
  notes           text,
  valid_until     date,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists turfcasa_quotes_status_idx
  on public.turfcasa_quotes (status, created_at desc);
create index if not exists turfcasa_quotes_account_idx
  on public.turfcasa_quotes (account_id);

alter table public.turfcasa_quotes enable row level security;

drop policy if exists "tc_quotes select" on public.turfcasa_quotes;
create policy "tc_quotes select" on public.turfcasa_quotes
  for select to authenticated using (true);
drop policy if exists "tc_quotes write" on public.turfcasa_quotes;
create policy "tc_quotes write" on public.turfcasa_quotes
  for all to authenticated using (true) with check (true);

-- ── quote lines ──────────────────────────────────────────────────────────────
create table if not exists public.turfcasa_quote_lines (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.turfcasa_quotes(id) on delete cascade,
  product_id  uuid references public.turfcasa_products(id) on delete set null,
  name        text not null,
  description text,
  qty         numeric(12, 2) not null default 1,
  unit_price  numeric(12, 2) not null default 0,
  taxable     boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists turfcasa_quote_lines_quote_idx
  on public.turfcasa_quote_lines (quote_id, sort_order);

alter table public.turfcasa_quote_lines enable row level security;

drop policy if exists "tc_quote_lines select" on public.turfcasa_quote_lines;
create policy "tc_quote_lines select" on public.turfcasa_quote_lines
  for select to authenticated using (true);
drop policy if exists "tc_quote_lines write" on public.turfcasa_quote_lines;
create policy "tc_quote_lines write" on public.turfcasa_quote_lines
  for all to authenticated using (true) with check (true);

-- ── catalog seed ─────────────────────────────────────────────────────────────
-- Product lines from the brand book. Prices intentionally NULL — real trade/
-- retail numbers are entered by the owner in-app, never invented here.
insert into public.turfcasa_products (name, category, unit, sort_order) values
  ('TexasLush',    'turf', 'sqft', 10),
  ('Saratoga 40',  'turf', 'sqft', 20),
  ('Saratoga 60',  'turf', 'sqft', 30),
  ('Kent 44',      'turf', 'sqft', 40),
  ('Majestic 70',  'turf', 'sqft', 50),
  ('Royal 40',     'turf', 'sqft', 60),
  ('TexasMonte',   'turf', 'sqft', 70),
  ('TexasMoss',    'turf', 'sqft', 80),
  ('TexasSun',     'turf', 'sqft', 90),
  ('TexasHaven',   'turf', 'sqft', 100),
  ('TexasPlay',    'turf', 'sqft', 110),
  ('Pet Turf',     'pet_turf', 'sqft', 120),
  ('TexasPutt',    'putting_green', 'sqft', 130),
  ('Blast Sand Infill',        'infill',      'bag',       200),
  ('Fine Sand Infill',         'infill',      'bag',       210),
  ('Wonderfill',               'infill',      'bag',       220),
  ('Turf Nails 4" (50lb box)', 'fastener',    'box',       230),
  ('Turf Staples (1,000 ct)',  'fastener',    'box',       240),
  ('Seam Tape',                'adhesive',    'roll',      250),
  ('XGS Adhesive',             'adhesive',    'each',      260),
  ('Metal Edging',             'edging',      'linear_ft', 270),
  ('WonderEdge',               'edging',      'linear_ft', 280),
  ('Decomposed Granite',       'ground_prep', 'bag',       290),
  ('Foam Pad',                 'ground_prep', 'sqft',      300),
  ('ProPlay Pad',              'ground_prep', 'sqft',      310),
  ('Weed Barrier',             'ground_prep', 'roll',      320),
  ('Putting Cups',             'putting_green', 'each',    330),
  ('Putting Flags & Poles',    'putting_green', 'each',    340)
on conflict do nothing;
