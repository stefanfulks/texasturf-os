-- Pitch v2 — multi-area quotes, site documentation, kiosk + public share.
-- All additive + idempotent. Data tables use the internal-team RLS (any
-- authenticated) that mirrors pitch_sessions. Private pitch-photos bucket
-- (per-user folder) + public pitch-assets bucket (admin-write only).

-- ── pitch_sessions: lifecycle timestamps + v2 quote + kiosk/share ──
alter table public.pitch_sessions
  add column if not exists documented_at    timestamptz,
  add column if not exists shared_at         timestamptz,
  add column if not exists explored_at       timestamptz,
  add column if not exists quoted_at          timestamptz,
  add column if not exists quote_total        numeric,                       -- client headline total (null => review)
  add column if not exists quote_v2           jsonb not null default '{}'::jsonb,  -- CLIENT-SAFE multi-area quote
  add column if not exists kiosk_pin_hash     text,                          -- hashed PIN to EXIT kiosk (never plaintext)
  add column if not exists share_token        text,                          -- high-entropy public-link token
  add column if not exists share_enabled      boolean not null default false,
  add column if not exists share_expires_at   timestamptz;

-- Partial unique index: at most one row per token, many nulls allowed.
create unique index if not exists pitch_sessions_share_token_key
  on public.pitch_sessions(share_token) where share_token is not null;

-- ── pitch_areas — per-area pricing inputs (PRIVATE; never sent to customers) ──
create table if not exists public.pitch_areas (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.pitch_sessions(id) on delete cascade,
  sort           integer not null default 0,
  label          text not null,                       -- "Backyard","Side yard","Pet area","Putting green"
  tier_key       text,                                -- chosen pitch_tier key, or null for ad-hoc product
  product        text not null,                       -- pricing/data.ts TURF_PRODUCTS key
  installed_sqft numeric not null default 0,
  application    text not null default 'soil',        -- 'soil' | 'concrete'
  tearout_tier   text not null default '1',
  access         text not null default 'normal',      -- 'normal' | 'difficult'
  infill_product text,
  edgings        jsonb not null default '[]'::jsonb,  -- {type,lf}[]
  extras         jsonb not null default '[]'::jsonb,  -- {description,cost}[]
  target_margin  numeric,                             -- null => inherit tier/default
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists pitch_areas_session_idx on public.pitch_areas(session_id, sort);

-- ── pitch_addons — drainage / pet infill / haul-away / putting green (PRIVATE cost) ──
create table if not exists public.pitch_addons (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.pitch_sessions(id) on delete cascade,
  sort        integer not null default 0,
  label       text not null,
  kind        text not null default 'custom',         -- drainage|pet_infill|haul_away|putting_green|custom
  cost        numeric not null default 0,             -- PRIVATE cost basis
  qty         numeric not null default 1,
  created_at  timestamptz not null default now()
);
create index if not exists pitch_addons_session_idx on public.pitch_addons(session_id, sort);

-- ── pitch_site_docs — site-wide conditions + use notes (one row per session) ──
create table if not exists public.pitch_site_docs (
  session_id  uuid primary key references public.pitch_sessions(id) on delete cascade,
  conditions  jsonb not null default '{}'::jsonb,     -- {surface,tearout_difficulty,access,slope_drainage,sprinklers}
  use_notes   jsonb not null default '{}'::jsonb,     -- {pets,kids,putting,problem_areas,free_text}
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);

-- ── pitch_photos — manifest rows pointing at the private pitch-photos bucket ──
create table if not exists public.pitch_photos (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.pitch_sessions(id) on delete cascade,
  area_id     uuid references public.pitch_areas(id) on delete set null,  -- null = site-wide
  category    text not null default 'area',           -- 'area'|'existing_surface'|'condition'
  path        text not null,
  name        text,
  sort        integer not null default 0,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index if not exists pitch_photos_session_idx on public.pitch_photos(session_id, sort);

-- ── RLS: internal team tool (any authenticated), mirrors pitch_sessions ──
alter table public.pitch_areas     enable row level security;
alter table public.pitch_addons    enable row level security;
alter table public.pitch_site_docs enable row level security;
alter table public.pitch_photos    enable row level security;

drop policy if exists pitch_areas_authd     on public.pitch_areas;
drop policy if exists pitch_addons_authd    on public.pitch_addons;
drop policy if exists pitch_site_docs_authd on public.pitch_site_docs;
drop policy if exists pitch_photos_authd    on public.pitch_photos;
create policy pitch_areas_authd     on public.pitch_areas     for all to authenticated using (true) with check (true);
create policy pitch_addons_authd    on public.pitch_addons    for all to authenticated using (true) with check (true);
create policy pitch_site_docs_authd on public.pitch_site_docs for all to authenticated using (true) with check (true);
create policy pitch_photos_authd    on public.pitch_photos    for all to authenticated using (true) with check (true);

-- ── Storage: private pitch-photos bucket (site documentation) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pitch-photos','pitch-photos', false, 15728640,  -- 15 MB phone photos
        array['image/png','image/jpeg','image/webp','image/heic'])
on conflict (id) do nothing;

drop policy if exists "pitch-photos read own or admin" on storage.objects;
create policy "pitch-photos read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'pitch-photos' and ((storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')));
drop policy if exists "pitch-photos insert own" on storage.objects;
create policy "pitch-photos insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'pitch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "pitch-photos update own" on storage.objects;
create policy "pitch-photos update own" on storage.objects for update to authenticated
  using (bucket_id = 'pitch-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'pitch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "pitch-photos delete own or admin" on storage.objects;
create policy "pitch-photos delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'pitch-photos' and ((storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')));

-- ── Storage: public pitch-assets bucket (curated marketing media) ──
-- public=true → objects are readable at the public URL (no signing). Writes are admin-only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pitch-assets','pitch-assets', true, 209715200,  -- 200 MB (testimonial video)
        array['image/png','image/jpeg','image/webp','video/mp4'])
on conflict (id) do nothing;

drop policy if exists "pitch-assets admin insert" on storage.objects;
create policy "pitch-assets admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'pitch-assets' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "pitch-assets admin update" on storage.objects;
create policy "pitch-assets admin update" on storage.objects for update to authenticated
  using (bucket_id = 'pitch-assets' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (bucket_id = 'pitch-assets' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "pitch-assets admin delete" on storage.objects;
create policy "pitch-assets admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pitch-assets' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
