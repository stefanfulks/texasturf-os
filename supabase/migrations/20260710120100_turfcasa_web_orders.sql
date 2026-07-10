-- TurfCasa web orders — paid storefront orders + their auto-invoice.
-- Additive only. Written by the order-intake webhook (service role) after
-- Stripe confirms payment; surfaced in /turfcasa/orders and tied to a
-- warehouse pull order (warehouse_pull_lists) so the crew can pull it.
--
--   turfcasa_orders        → one paid web order (idempotent on stripe_session_id)
--   turfcasa_order_lines   → its line items (priced in cents, as charged)
--   turfcasa_invoices      → the auto-generated PAID receipt for the order
--
-- Money is stored in integer cents exactly as Stripe charged it — no recompute,
-- no rounding drift. pull_list_id links to the warehouse pull order.

create sequence if not exists public.turfcasa_order_number_seq start 5001;
create sequence if not exists public.turfcasa_invoice_number_seq start 5001;

-- ── orders ───────────────────────────────────────────────────────────────────
create table if not exists public.turfcasa_orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       bigint not null unique
                     default nextval('public.turfcasa_order_number_seq'),
  stripe_session_id  text not null unique,
  status             text not null default 'paid'
                     check (status in ('paid', 'pulling', 'ready', 'fulfilled', 'cancelled')),
  customer_name      text,
  customer_email     text,
  customer_phone     text,
  fulfillment_method text not null default 'pickup'
                     check (fulfillment_method in ('pickup', 'delivery', 'freight')),
  fulfillment_zip    text,
  pricing_role       text not null default 'retail',
  currency           text not null default 'usd',
  subtotal_cents     integer not null default 0,
  tax_cents          integer not null default 0,
  shipping_cents     integer not null default 0,
  total_cents        integer not null default 0,
  account_id         uuid references public.turfcasa_accounts(id) on delete set null,
  invoice_id         uuid,
  pull_list_id       uuid references public.warehouse_pull_lists(id) on delete set null,
  notes              text,
  placed_at          timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists turfcasa_orders_status_idx
  on public.turfcasa_orders (status, placed_at desc);

alter table public.turfcasa_orders enable row level security;

drop policy if exists "tc_orders select" on public.turfcasa_orders;
create policy "tc_orders select" on public.turfcasa_orders
  for select to authenticated using (true);
-- Staff can advance status (pulling/ready/fulfilled). Inserts come from the
-- service-role intake webhook, which bypasses RLS.
drop policy if exists "tc_orders write" on public.turfcasa_orders;
create policy "tc_orders write" on public.turfcasa_orders
  for all to authenticated using (true) with check (true);

-- ── order lines ──────────────────────────────────────────────────────────────
create table if not exists public.turfcasa_order_lines (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.turfcasa_orders(id) on delete cascade,
  web_slug           text,
  product_name       text,
  name               text not null,
  unit               text,
  quantity           numeric(12, 2) not null default 1,
  unit_price_cents   integer not null default 0,
  line_total_cents   integer not null default 0,
  turfcasa_product_id uuid references public.turfcasa_products(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists turfcasa_order_lines_order_idx
  on public.turfcasa_order_lines (order_id);

alter table public.turfcasa_order_lines enable row level security;

drop policy if exists "tc_order_lines select" on public.turfcasa_order_lines;
create policy "tc_order_lines select" on public.turfcasa_order_lines
  for select to authenticated using (true);
drop policy if exists "tc_order_lines write" on public.turfcasa_order_lines;
create policy "tc_order_lines write" on public.turfcasa_order_lines
  for all to authenticated using (true) with check (true);

-- ── auto-invoice (paid receipt) ──────────────────────────────────────────────
-- Payment is already captured by Stripe, so the invoice is issued 'paid'. Money
-- mirrors the order in cents; tax_rate kept for parity with the quoting model.
create table if not exists public.turfcasa_invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_number  bigint not null unique
                  default nextval('public.turfcasa_invoice_number_seq'),
  order_id        uuid not null references public.turfcasa_orders(id) on delete cascade,
  account_id      uuid references public.turfcasa_accounts(id) on delete set null,
  status          text not null default 'paid'
                  check (status in ('paid', 'unpaid', 'void', 'refunded')),
  tax_rate        numeric(6, 3) not null default 8.25,
  subtotal_cents  integer not null default 0,
  tax_cents       integer not null default 0,
  total_cents     integer not null default 0,
  source          text not null default 'web_order',
  issued_at       timestamptz not null default now(),
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

create unique index if not exists turfcasa_invoices_order_idx
  on public.turfcasa_invoices (order_id);

alter table public.turfcasa_invoices enable row level security;

drop policy if exists "tc_invoices select" on public.turfcasa_invoices;
create policy "tc_invoices select" on public.turfcasa_invoices
  for select to authenticated using (true);
drop policy if exists "tc_invoices write" on public.turfcasa_invoices;
create policy "tc_invoices write" on public.turfcasa_invoices
  for all to authenticated using (true) with check (true);

-- Late FK: orders.invoice_id → invoices (both now exist).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'turfcasa_orders_invoice_id_fkey'
  ) then
    alter table public.turfcasa_orders
      add constraint turfcasa_orders_invoice_id_fkey
      foreign key (invoice_id) references public.turfcasa_invoices(id) on delete set null;
  end if;
end $$;
