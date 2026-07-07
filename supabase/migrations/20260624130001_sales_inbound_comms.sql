-- Sales inbound comms (phase 3a): triage queue for inbound voicemails from
-- callers we don't have in sales_contacts. Office resolves these by
-- converting to a deal or marking handled. Additive only.

create table if not exists public.unmatched_calls (
  id              uuid primary key default gen_random_uuid(),
  from_number     text not null,
  recording_url   text,
  recording_sid   text,
  duration_sec    integer,
  transcript      text,
  occurred_at     timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users(id),
  resolution_note text
);

create index if not exists unmatched_calls_occurred_idx on public.unmatched_calls(occurred_at desc);
create index if not exists unmatched_calls_open_idx     on public.unmatched_calls(occurred_at desc) where resolved_at is null;

alter table public.unmatched_calls enable row level security;

-- Internal team tool (mirrors deals/sales_contacts policy).
drop policy if exists unmatched_calls_authd on public.unmatched_calls;
create policy unmatched_calls_authd on public.unmatched_calls for all to authenticated using (true) with check (true);
