-- Power dialer foundation (calling suite Phase 1) — additive only.
-- Per docs/superpowers/specs/2026-06-25-power-dialer-design.md, extended by the
-- 2026-07-15 calling-suite build prompt (TurfCasa customers as dial targets).
--
--   call_lists       → one row = one named list/campaign (team-shared)
--   call_list_items  → the people on a list (polymorphic dial target)
--   call_attempts    → one row per dial — the dialer's own outcome log
--
-- "Enums" are text + CHECK per current repo convention (idempotent, and lets
-- dial_target carry turfcasa_customer without an ALTER TYPE dance):
--   list status:  active | completed | archived
--   item status:  pending | called | skipped | done
--   outcome:      connected | no_answer | voicemail | busy | bad_number |
--                 callback_scheduled | not_interested | do_not_call
--   dial target:  sales_contact | jobber_client | turfcasa_customer
--                 (kept separate from taggable_entity so tasks/invoices/etc.
--                 never become dialable)

-- ── call_lists ───────────────────────────────────────────────────────────────
create table if not exists public.call_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  -- Which brand the list dials for (drives caller talk track + reporting).
  brand       text not null default 'texasturf'
              check (brand in ('texasturf', 'turfcasa')),
  status      text not null default 'active'
              check (status in ('active', 'completed', 'archived')),
  -- Team-shared via RLS; owner_id drives the "My lists" filter only.
  owner_id    uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists call_lists_status_idx
  on public.call_lists (status, created_at desc);

alter table public.call_lists enable row level security;

drop policy if exists "call_lists all" on public.call_lists;
create policy "call_lists all" on public.call_lists
  for all to authenticated using (true) with check (true);

-- ── call_list_items ──────────────────────────────────────────────────────────
create table if not exists public.call_list_items (
  id             uuid primary key default gen_random_uuid(),
  call_list_id   uuid not null references public.call_lists(id) on delete cascade,
  target_type    text not null
                 check (target_type in ('sales_contact', 'jobber_client', 'turfcasa_customer')),
  -- text, not uuid: holds uuid contacts, text Jobber ids, and normalized
  -- phone digits for TurfCasa customers (deduped by phone across orders).
  target_id      text not null,
  position       integer not null default 0,
  status         text not null default 'pending'
                 check (status in ('pending', 'called', 'skipped', 'done')),
  attempts       integer not null default 0,
  last_outcome   text
                 check (last_outcome is null or last_outcome in
                        ('connected', 'no_answer', 'voicemail', 'busy', 'bad_number',
                         'callback_scheduled', 'not_interested', 'do_not_call')),
  called_at      timestamptz,
  -- Snapshots captured at add time so the row still renders if the source
  -- record changes (or, for TurfCasa, has no standalone customer record).
  snapshot_name  text,
  snapshot_phone text,
  snapshot_company text,
  added_by       uuid references public.profiles(id) on delete set null,
  added_at       timestamptz not null default now()
);

-- No dupes on one list.
create unique index if not exists call_list_items_target_uniq
  on public.call_list_items (call_list_id, target_type, target_id);
-- Ordered fetch of the active list.
create index if not exists call_list_items_position_idx
  on public.call_list_items (call_list_id, position);

alter table public.call_list_items enable row level security;

drop policy if exists "call_list_items all" on public.call_list_items;
create policy "call_list_items all" on public.call_list_items
  for all to authenticated using (true) with check (true);

-- ── call_attempts ────────────────────────────────────────────────────────────
create table if not exists public.call_attempts (
  id                 uuid primary key default gen_random_uuid(),
  call_list_item_id  uuid references public.call_list_items(id) on delete cascade,
  call_list_id       uuid references public.call_lists(id) on delete cascade,
  target_type        text not null
                     check (target_type in ('sales_contact', 'jobber_client', 'turfcasa_customer')),
  target_id          text not null,
  -- Linked when the target has a deal, so the deal timeline stays complete.
  deal_id            uuid references public.deals(id) on delete set null,
  rep_id             uuid not null references public.profiles(id),
  -- Human disposition, chosen by the rep after hangup (reporting keys off this).
  outcome            text
                     check (outcome is null or outcome in
                            ('connected', 'no_answer', 'voicemail', 'busy', 'bad_number',
                             'callback_scheduled', 'not_interested', 'do_not_call')),
  -- Twilio's mechanical status (completed/no-answer/busy/failed), set by the
  -- voice-status webhook. Deliberately separate from the human disposition.
  twilio_status      text,
  call_sid           text,
  duration_sec       integer,
  note               text,
  callback_at        timestamptz,
  created_at         timestamptz not null default now()
);

-- Webhook lookup.
create index if not exists call_attempts_call_sid_idx
  on public.call_attempts (call_sid);
-- Per-rep activity / reporting.
create index if not exists call_attempts_rep_idx
  on public.call_attempts (rep_id, created_at desc);
create index if not exists call_attempts_list_idx
  on public.call_attempts (call_list_id, created_at desc);

alter table public.call_attempts enable row level security;

drop policy if exists "call_attempts all" on public.call_attempts;
create policy "call_attempts all" on public.call_attempts
  for all to authenticated using (true) with check (true);
