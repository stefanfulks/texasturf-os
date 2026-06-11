-- Meetings v2: one-time meetings, per-person invites, Google Meet links.
--
-- - scheduled_on:      the single date a cadence='once' meeting happens
-- - invited_user_ids:  people invited directly (in addition to role/department
--                      access); they can see the meeting regardless of role
-- - meet_url:          Google Meet link auto-created with the calendar event
--                      (or pasted manually)
-- - gcal_event_id:     the Google Calendar event backing the Meet link

alter table public.meetings
  add column if not exists scheduled_on date,
  add column if not exists invited_user_ids uuid[] not null default '{}',
  add column if not exists meet_url text,
  add column if not exists gcal_event_id text;

-- A one-time meeting must know when it happens. Existing rows are unaffected
-- (no 'once' rows exist before this migration).
do $$ begin
  alter table public.meetings
    add constraint meetings_once_needs_date
    check (cadence <> 'once' or scheduled_on is not null);
exception when duplicate_object then null; end $$;

-- Visibility now includes direct invites. Note the "wide open" clause also
-- gains the invited check: a meeting with ONLY invited people is private to
-- them, not visible to everyone.
create or replace function public.user_can_see_meeting(m public.meetings)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    -- Admin always sees everything.
    public.current_role() = 'admin'
    -- Wide-open meeting: no role/department/person restriction at all.
    or (
      cardinality(m.allowed_roles) = 0
      and cardinality(m.allowed_departments) = 0
      and cardinality(m.invited_user_ids) = 0
    )
    -- Role match.
    or public.current_role() = any(m.allowed_roles)
    -- Directly invited.
    or auth.uid() = any(m.invited_user_ids)
    -- Department overlap.
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and cardinality(m.allowed_departments) > 0
        and p.departments && m.allowed_departments
    );
$$;
