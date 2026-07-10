-- TurfCasa orders foundation — additive only. (Rewrote the never-applied
-- quoting draft: Jobber STAYS the system of record for quotes/invoices/
-- billing; this app runs what Jobber can't — website order intake and
-- warehouse fulfillment.)
--
--   turfcasa_products      → catalog (trade/retail price, unit) — feeds order
--                            lines now, the website later
--   turfcasa_orders        → order header (source, customer, fulfillment,
--                            warehouse status lifecycle, Jobber billing link)
--   turfcasa_order_lines   → what was ordered
--   turfcasa_order_events  → audit trail of every status change / note

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

-- ── orders ───────────────────────────────────────────────────────────────────
create sequence if not exists public.turfcasa_order_number_seq start 2001;

create table if not exists public.turfcasa_orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          bigint not null unique
                        default nextval('public.turfcasa_order_number_seq'),
  source                text not null default 'website'
                        check (source in ('website', 'phone', 'walk_in')),
  status                text not null default 'new'
                        check (status in ('new', 'confirmed', 'picking', 'ready',
                                          'fulfilled', 'cancelled')),
  fulfillment           text not null default 'will_call'
                        check (fulfillment in ('will_call', 'delivery')),
  customer_name         text not null,
  customer_email        text,
  customer_phone        text,
  company               text,
  is_trade              boolean not null default false,
  delivery_address      text,
  requested_date        date,
  -- Money fields are informational (what the website/phone quoted the
  -- customer). Billing itself happens in Jobber; link it below.
  subtotal              numeric(12, 2),
  total                 numeric(12, 2),
  notes                 text,
  jobber_client_id      text,
  jobber_invoice_number text,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists turfcasa_orders_status_idx
  on public.turfcasa_orders (status, created_at desc);
create index if not exists turfcasa_orders_created_idx
  on public.turfcasa_orders (created_at desc);

alter table public.turfcasa_orders enable row level security;

drop policy if exists "tc_orders select" on public.turfcasa_orders;
create policy "tc_orders select" on public.turfcasa_orders
  for select to authenticated using (true);
drop policy if exists "tc_orders write" on public.turfcasa_orders;
create policy "tc_orders write" on public.turfcasa_orders
  for all to authenticated using (true) with check (true);

-- ── order lines ──────────────────────────────────────────────────────────────
create table if not exists public.turfcasa_order_lines (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.turfcasa_orders(id) on delete cascade,
  product_id  uuid references public.turfcasa_products(id) on delete set null,
  name        text not null,
  qty         numeric(12, 2) not null default 1,
  unit        text not null default 'each',
  unit_price  numeric(12, 2),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists turfcasa_order_lines_order_idx
  on public.turfcasa_order_lines (order_id, sort_order);

alter table public.turfcasa_order_lines enable row level security;

drop policy if exists "tc_order_lines select" on public.turfcasa_order_lines;
create policy "tc_order_lines select" on public.turfcasa_order_lines
  for select to authenticated using (true);
drop policy if exists "tc_order_lines write" on public.turfcasa_order_lines;
create policy "tc_order_lines write" on public.turfcasa_order_lines
  for all to authenticated using (true) with check (true);

-- ── order events (warehouse audit trail) ─────────────────────────────────────
create table if not exists public.turfcasa_order_events (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.turfcasa_orders(id) on delete cascade,
  event        text not null default 'status_changed'
               check (event in ('created', 'status_changed', 'note')),
  from_status  text,
  to_status    text,
  note         text,
  -- null actor = the website / system; a profile id = a teammate.
  actor        uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists turfcasa_order_events_order_idx
  on public.turfcasa_order_events (order_id, created_at desc);

alter table public.turfcasa_order_events enable row level security;

drop policy if exists "tc_order_events select" on public.turfcasa_order_events;
create policy "tc_order_events select" on public.turfcasa_order_events
  for select to authenticated using (true);
drop policy if exists "tc_order_events write" on public.turfcasa_order_events;
create policy "tc_order_events write" on public.turfcasa_order_events
  for all to authenticated using (true) with check (true);

-- ── catalog seed ─────────────────────────────────────────────────────────────
-- Product lines from the brand book. Prices intentionally NULL — real trade/
-- retail numbers are entered by the owner in-app, never invented here.
insert into public.turfcasa_products (name, category, unit, sort_order)
select v.name, v.category, v.unit, v.sort_order
from (values
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
) as v(name, category, unit, sort_order)
where not exists (
  select 1 from public.turfcasa_products p where p.name = v.name
);
