-- TurfCasa web storefront — availability layer + sanitized public read view.
-- Additive only. Pairs with the turfcasa.com storefront (separate repo), which
-- is the presentation layer; this OS stays the source of truth for what's
-- sellable, its retail price, and its availability/lead-time.
--
--   turfcasa_web_availability  → one row per storefront product (by web_slug),
--                                office-editable availability tier + visibility
--   v_turfcasa_web_products    → sanitized, anon-readable view the site reads
--                                (no cost/trade pricing exposed); availability
--                                auto-promotes to same_day when rolls are on hand
--
-- web_slug == the storefront product slug (stable join key across the two apps).
-- product_name links a TurfCasa-brand row to turfcasa_products (price) and to
-- inv_products/inv_items (on-hand check). Shaw + supply rows leave it null and
-- keep their site-managed price until onboarded.

-- ── availability (office-editable) ───────────────────────────────────────────
create table if not exists public.turfcasa_web_availability (
  web_slug       text primary key,
  manufacturer   text not null check (manufacturer in ('shaw', 'turfcasa')),
  product_name   text,
  availability   text not null default 'lead_1_2_days'
                 check (availability in ('same_day', 'lead_1_2_days',
                                         'lead_weeks', 'lead_months', 'unavailable')),
  lead_time_days int,
  web_visible    boolean not null default true,
  updated_by     uuid references public.profiles(id) on delete set null,
  updated_at     timestamptz not null default now()
);

create index if not exists turfcasa_web_availability_manufacturer_idx
  on public.turfcasa_web_availability (manufacturer, web_slug);

alter table public.turfcasa_web_availability enable row level security;

-- Office staff read/write availability; pricing stays admin-gated on
-- turfcasa_products (unchanged). Storefront never uses these policies — it
-- reads the sanitized view below with the anon key.
drop policy if exists "tc_web_avail select" on public.turfcasa_web_availability;
create policy "tc_web_avail select" on public.turfcasa_web_availability
  for select to authenticated using (true);
drop policy if exists "tc_web_avail write" on public.turfcasa_web_availability;
create policy "tc_web_avail write" on public.turfcasa_web_availability
  for all to authenticated using (true) with check (true);

-- ── seed: one row per current storefront product ─────────────────────────────
-- Availability defaults to 'lead_1_2_days' (no same-day stock in hand today;
-- most items pull from the Dallas supplier in a day or two). Office adjusts
-- per product/manufacturer in /turfcasa/catalog.
insert into public.turfcasa_web_availability (web_slug, manufacturer, product_name) values
  ('summer-rye', 'shaw', null),
  ('fresh-rye', 'shaw', null),
  ('foundations-heritage', 'shaw', null),
  ('foundations-liberty', 'shaw', null),
  ('foundations-anthem', 'shaw', null),
  ('foundations-freedom', 'shaw', null),
  ('k9-park', 'shaw', null),
  ('k9-serenity', 'shaw', null),
  ('velora-aire', 'shaw', null),
  ('velora-core', 'shaw', null),
  ('velora-edge', 'shaw', null),
  ('solana-62', 'shaw', null),
  ('solana-75', 'shaw', null),
  ('navigation-trek', 'shaw', null),
  ('navigation-adventure', 'shaw', null),
  ('navigation-excursion', 'shaw', null),
  ('meraki-zeal', 'shaw', null),
  ('meraki-mania', 'shaw', null),
  ('meraki-craze', 'shaw', null),
  ('meraki-frenzy', 'shaw', null),
  ('imagination-creativity', 'shaw', null),
  ('imagination-discovery', 'shaw', null),
  ('playcolor', 'shaw', null),
  ('hopscotch', 'shaw', null),
  ('tips-elite-putt', 'shaw', null),
  ('tips-pro-putt', 'shaw', null),
  ('tips-champion', 'shaw', null),
  ('tips-tee-line', 'shaw', null),
  ('tips-ny-tee-line', 'shaw', null),
  ('tips-ny-pro-stroke', 'shaw', null),
  ('dura-putt', 'shaw', null),
  ('elevate-28-ny', 'shaw', null),
  ('elevate-45', 'shaw', null),
  ('pro-court', 'shaw', null),
  ('accelerate-62', 'shaw', null),
  ('accelerate-80', 'shaw', null),
  ('movement-pro-2', 'shaw', null),
  ('powerpro', 'shaw', null),
  ('journey', 'shaw', null),
  ('reflex', 'shaw', null),
  ('texassun', 'turfcasa', 'TexasSun'),
  ('texasmonte', 'turfcasa', 'TexasMonte'),
  ('texasmoss', 'turfcasa', 'TexasMoss'),
  ('texashaven', 'turfcasa', 'TexasHaven'),
  ('texasplay', 'turfcasa', 'TexasPlay'),
  ('saratoga-40', 'turfcasa', 'Saratoga 40'),
  ('saratoga-60', 'turfcasa', 'Saratoga 60'),
  ('royal-40', 'turfcasa', 'Royal 40'),
  ('kent-44', 'turfcasa', 'Kent 44'),
  ('texasputt', 'turfcasa', 'TexasPutt'),
  ('xgs-glue-seam-binder', 'turfcasa', null),
  ('xgs-seam-tape', 'turfcasa', null),
  ('blast-sand', 'turfcasa', null),
  ('fine-sand', 'turfcasa', null),
  ('wonderfill-green-12-20', 'turfcasa', null),
  ('wonderfill-green-black-30-50', 'turfcasa', null),
  ('shaw-k9-sand', 'shaw', null),
  ('shaw-hydrochill', 'shaw', null),
  ('decomposed-granite', 'turfcasa', null),
  ('foam-landscape-pad', 'turfcasa', null),
  ('proplay-sport23-pad', 'turfcasa', null),
  ('realturf-brush-and-go', 'turfcasa', null),
  ('turf-knife', 'turfcasa', null),
  ('turf-kicker-crain-505', 'turfcasa', null),
  ('turf-shears', 'turfcasa', null),
  ('turf-blades', 'turfcasa', null),
  ('turf-nails', 'turfcasa', null),
  ('turf-staples', 'turfcasa', null),
  ('metal-edging', 'turfcasa', null),
  ('wonderedge', 'turfcasa', null),
  ('weed-barrier-12x300', 'turfcasa', null),
  ('weed-barrier-6x300', 'turfcasa', null),
  ('putting-green-accessories', 'turfcasa', null)
on conflict (web_slug) do nothing;

-- ── sanitized public read view ───────────────────────────────────────────────
-- Runs with definer rights (not security_invoker) so anon can read ONLY these
-- curated columns without touching the underlying tables' RLS. No unit_cost or
-- trade_price is ever exposed.
create or replace view public.v_turfcasa_web_products as
select
  wa.web_slug,
  wa.manufacturer,
  case
    when wa.product_name is not null and (
      exists (
        select 1
        from public.inv_products ip
        join public.inv_rolls r on r.product_id = ip.id
        where lower(ip.name) = lower(wa.product_name)
          and r.status = 'available'
          and coalesce(r.current_length_ft, 0) > 0
      )
      or exists (
        select 1
        from public.inv_items ii
        where lower(ii.name) = lower(wa.product_name)
          and coalesce(ii.quantity, 0) > 0
      )
    ) then 'same_day'
    else wa.availability
  end as availability,
  wa.lead_time_days,
  case
    when tp.retail_price is not null then round(tp.retail_price * 100)::int
    else null
  end as retail_price_cents,
  wa.web_visible
from public.turfcasa_web_availability wa
left join public.turfcasa_products tp on lower(tp.name) = lower(wa.product_name);

-- Expose to the storefront's anon key (read-only) and to signed-in staff.
grant select on public.v_turfcasa_web_products to anon, authenticated;
