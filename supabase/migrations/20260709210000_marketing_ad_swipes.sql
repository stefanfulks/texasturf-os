-- Ad Lab: swipe file of ads worth copying. Drag-and-drop board
-- (inbox → transcribed → analyzed → drafted); each swipe holds the source
-- link, an uploaded copy of the video (for Whisper transcription), the AI
-- structure breakdown, and generated variants for BOTH brands
-- (texasturf + turfcasa). Additive only.

create table if not exists public.marketing_ad_swipes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  source_url  text,
  platform    text,                          -- 'facebook' | 'instagram' | 'youtube' | 'tiktok' | 'other'
  status      text not null default 'inbox', -- inbox | transcribed | analyzed | drafted
  transcript  text,
  structure   jsonb,                         -- AI breakdown: hook/beats/offer/cta/why-it-works
  variants    jsonb not null default '{}'::jsonb, -- { texasturf: [...], turfcasa: [...] }
  notes       text,
  asset_path  text,                          -- uploaded video/audio in the marketing bucket
  sort_order  int not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists marketing_ad_swipes_status_idx
  on public.marketing_ad_swipes (status, sort_order, created_at desc);

alter table public.marketing_ad_swipes enable row level security;

drop policy if exists "ad_swipes select" on public.marketing_ad_swipes;
create policy "ad_swipes select" on public.marketing_ad_swipes
  for select to authenticated using (true);
drop policy if exists "ad_swipes marketing write" on public.marketing_ad_swipes;
create policy "ad_swipes marketing write" on public.marketing_ad_swipes
  for all to authenticated
  using (public.user_is_marketing()) with check (public.user_is_marketing());

drop trigger if exists touch_marketing_ad_swipes on public.marketing_ad_swipes;
create trigger touch_marketing_ad_swipes before update on public.marketing_ad_swipes
  for each row execute function public.touch_updated_at();
