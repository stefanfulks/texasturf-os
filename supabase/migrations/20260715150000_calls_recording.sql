-- Calling suite Phase 2 — call recording. Additive only.
--
--   calls          → one row per placed call, both brands (dialer + deal
--                    button). The anchor recording/transcript/AI review hang
--                    off (Phase 3 adds transcript + call_ai_reviews).
--   call_settings  → key/value jsonb (mirrors inv_settings), seeds the
--                    "this call may be recorded" announcement toggle —
--                    default ON (Texas is one-party consent, but out-of-state
--                    callees may not be).

-- ── calls ────────────────────────────────────────────────────────────────────
create table if not exists public.calls (
  id                uuid primary key default gen_random_uuid(),
  -- Dialer linkage (null for deal-button calls placed outside a list).
  call_attempt_id   uuid references public.call_attempts(id) on delete set null,
  deal_id           uuid references public.deals(id) on delete set null,
  caller_id         uuid not null references public.profiles(id),
  target_type       text
                    check (target_type is null or target_type in
                           ('sales_contact', 'jobber_client', 'turfcasa_customer')),
  target_id         text,
  -- Display snapshots so the calls list renders without polymorphic joins.
  target_name       text,
  target_phone      text,
  direction         text not null default 'outbound'
                    check (direction in ('outbound', 'inbound')),
  twilio_call_sid   text,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  duration_sec      integer,
  -- Human disposition, mirrored from the dialer (null for un-dispositioned).
  outcome           text
                    check (outcome is null or outcome in
                           ('connected', 'no_answer', 'voicemail', 'busy', 'bad_number',
                            'callback_scheduled', 'not_interested', 'do_not_call')),
  recording_sid     text,
  recording_url     text,
  -- Twilio recording lifecycle: in-progress | completed | absent | failed.
  recording_status  text,
  brand             text not null default 'texasturf'
                    check (brand in ('texasturf', 'turfcasa')),
  created_at        timestamptz not null default now()
);

create unique index if not exists calls_twilio_call_sid_uniq
  on public.calls (twilio_call_sid) where twilio_call_sid is not null;
-- Idempotency anchor for the recording webhook + Phase-3 AI pipeline.
create unique index if not exists calls_recording_sid_uniq
  on public.calls (recording_sid) where recording_sid is not null;
create index if not exists calls_created_idx
  on public.calls (created_at desc);
create index if not exists calls_caller_idx
  on public.calls (caller_id, created_at desc);
create index if not exists calls_brand_idx
  on public.calls (brand, created_at desc);

alter table public.calls enable row level security;

drop policy if exists "calls all" on public.calls;
create policy "calls all" on public.calls
  for all to authenticated using (true) with check (true);

-- ── call_settings (key/value) ────────────────────────────────────────────────
create table if not exists public.call_settings (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  value       jsonb,
  description text,
  updated_at  timestamptz not null default now()
);

alter table public.call_settings enable row level security;

drop policy if exists "call_settings select" on public.call_settings;
create policy "call_settings select" on public.call_settings
  for select to authenticated using (true);
-- Recording-consent posture is an owner decision.
drop policy if exists "call_settings admin write" on public.call_settings;
create policy "call_settings admin write" on public.call_settings
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.call_settings (key, value, description)
values (
  'record_announcement',
  'true'::jsonb,
  'Play "this call may be recorded" to the customer before bridging. Texas is one-party consent; keep ON for out-of-state safety.'
)
on conflict (key) do nothing;
