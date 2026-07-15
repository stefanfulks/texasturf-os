-- Calling suite Phase 3 — transcription + AI call review. Additive only.
--
--   calls.transcript      → Whisper output stored on the call row
--   call_ai_reviews       → one AI review per call (Claude), UNIQUE(call_id)
--                           so webhook retries can't double-review or
--                           double-create follow-up tasks (calls itself is
--                           already unique per recording_sid).
--
-- Follow-up actions become real `tasks` rows (tagged 'call-followup' +
-- 'call:<call id>') — no custom task system.

alter table public.calls
  add column if not exists transcript text,
  add column if not exists transcribed_at timestamptz;

create table if not exists public.call_ai_reviews (
  id             uuid primary key default gen_random_uuid(),
  call_id        uuid not null unique references public.calls(id) on delete cascade,
  summary        text not null,
  outcome_class  text not null
                 check (outcome_class in
                        ('connected_interested', 'connected_not_interested',
                         'callback_requested', 'voicemail', 'wrong_number', 'no_decision')),
  interest_level integer not null check (interest_level between 1 and 5),
  objections     jsonb not null default '[]'::jsonb,
  commitments    jsonb not null default '[]'::jsonb,
  coaching_notes text,
  follow_ups     jsonb not null default '[]'::jsonb,
  model          text,
  tokens_input   integer,
  tokens_output  integer,
  created_at     timestamptz not null default now()
);

create index if not exists call_ai_reviews_created_idx
  on public.call_ai_reviews (created_at desc);
create index if not exists call_ai_reviews_interest_idx
  on public.call_ai_reviews (interest_level, created_at desc);

alter table public.call_ai_reviews enable row level security;

-- Reviews are written by the webhook pipeline (service role); the team reads.
drop policy if exists "call_ai_reviews select" on public.call_ai_reviews;
create policy "call_ai_reviews select" on public.call_ai_reviews
  for select to authenticated using (true);
