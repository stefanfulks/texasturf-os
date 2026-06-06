-- TexasTurf OS — Meetings (generalized)
--
-- Every role has meetings: Leadership (Friday), Sales huddle, Field morning,
-- Operations sync, etc. Each meeting has its own cadence, time, sections,
-- and access rules. Items get filed by anyone with access; the meeting's
-- "doc" view is the populated agenda rendered from those items.
--
-- (This replaces the earlier leadership-only schema we never applied.)

do $$ begin
  create type public.meeting_cadence as enum (
    'daily', 'weekly', 'biweekly', 'monthly', 'adhoc'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.meeting_item_status as enum (
    'pending', 'carried_over', 'discussed', 'done', 'archived'
  );
exception when duplicate_object then null; end $$;

-- ─── meetings ────────────────────────────────────────────────────────────────

create table if not exists public.meetings (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  name                 text not null,
  description          text,
  cadence              public.meeting_cadence not null default 'weekly',
  day_of_week          int check (day_of_week between 0 and 6),  -- 0=Sun, 5=Fri
  day_of_month         int check (day_of_month between 1 and 31),
  start_time           time,
  duration_min         int,
  -- Empty roles AND empty departments = visible to everyone.
  -- Otherwise: visible if user's role matches OR any of their departments
  -- intersects allowed_departments. Admins always see everything.
  allowed_roles        public.user_role[]       not null default '{}',
  allowed_departments  public.user_department[] not null default '{}',
  -- Section definitions live as JSON so each meeting can have its own
  -- structure without a schema migration. Shape per section:
  --   { key, label, emoji, time_min, owner, accent, placeholder,
  --     wants_owner, wants_due, is_action }
  sections             jsonb not null default '[]'::jsonb,
  archived             boolean not null default false,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists meetings_slug_idx on public.meetings (slug);

drop trigger if exists touch_meetings on public.meetings;
create trigger touch_meetings before update on public.meetings
  for each row execute function public.touch_updated_at();

-- ─── meeting_items ───────────────────────────────────────────────────────────

create table if not exists public.meeting_items (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.meetings(id) on delete cascade,
  occurs_on    date not null,
  section_key  text not null,
  title        text not null,
  body         text,
  status       public.meeting_item_status not null default 'pending',
  owner_id     uuid references public.profiles(id) on delete set null,
  due_date     date,
  author_id    uuid not null references public.profiles(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists meeting_items_meeting_idx
  on public.meeting_items (meeting_id, occurs_on);
create index if not exists meeting_items_status_idx
  on public.meeting_items (status)
  where status in ('pending', 'carried_over');
create index if not exists meeting_items_owner_idx
  on public.meeting_items (owner_id)
  where owner_id is not null;

drop trigger if exists touch_meeting_items on public.meeting_items;
create trigger touch_meeting_items before update on public.meeting_items
  for each row execute function public.touch_updated_at();

-- ─── Access helper ───────────────────────────────────────────────────────────
--
-- Used by RLS to decide if the caller can see/contribute to a given meeting.

create or replace function public.user_can_see_meeting(m public.meetings)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    -- Admin always sees everything.
    public.current_role() = 'admin'
    -- Wide-open meeting: no role/department restriction.
    or (
      cardinality(m.allowed_roles) = 0
      and cardinality(m.allowed_departments) = 0
    )
    -- Role match.
    or public.current_role() = any(m.allowed_roles)
    -- Department overlap.
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and cardinality(m.allowed_departments) > 0
        and p.departments && m.allowed_departments
    );
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.meetings enable row level security;
alter table public.meeting_items enable row level security;

drop policy if exists "meetings select access" on public.meetings;
create policy "meetings select access"
  on public.meetings for select
  to authenticated
  using (public.user_can_see_meeting(meetings));

-- Only admins can create / edit / archive meetings themselves.
drop policy if exists "meetings admin write" on public.meetings;
create policy "meetings admin write"
  on public.meetings for all
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- meeting_items: must be able to see the parent meeting.
drop policy if exists "meeting_items select" on public.meeting_items;
create policy "meeting_items select"
  on public.meeting_items for select
  to authenticated
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_items.meeting_id
        and public.user_can_see_meeting(m)
    )
  );

drop policy if exists "meeting_items insert self" on public.meeting_items;
create policy "meeting_items insert self"
  on public.meeting_items for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_items.meeting_id
        and public.user_can_see_meeting(m)
    )
  );

drop policy if exists "meeting_items update" on public.meeting_items;
create policy "meeting_items update"
  on public.meeting_items for update
  to authenticated
  using (
    author_id = auth.uid()
    or owner_id = auth.uid()
    or public.current_role() in ('admin', 'office')
  )
  with check (
    author_id = auth.uid()
    or owner_id = auth.uid()
    or public.current_role() in ('admin', 'office')
  );

drop policy if exists "meeting_items delete admin" on public.meeting_items;
create policy "meeting_items delete admin"
  on public.meeting_items for delete
  to authenticated
  using (public.current_role() in ('admin', 'office'));

-- ─── Seed: Weekly Leadership Meeting ─────────────────────────────────────────
--
-- Pre-populated from the existing Google Doc template so the team can drop
-- straight into the new system without re-entering structure.

insert into public.meetings (
  slug, name, description, cadence, day_of_week, start_time, duration_min,
  allowed_roles, sections
) values (
  'leadership-weekly',
  'Weekly Leadership Meeting',
  'Tactical coordination, week-in-review, identify blockers, plan upcoming week',
  'weekly',
  5,        -- Friday
  '07:00',
  60,
  ARRAY['admin']::public.user_role[],
  '[
    {"key":"check_in","label":"Check-In & Wins","emoji":"🎉","time_min":5,"owner":"All","accent":"amber","placeholder":"Closed the Whitmore install ahead of schedule"},
    {"key":"finance","label":"Finance Quick Pulse","emoji":"💰","time_min":5,"owner":"Troy & Ivana","accent":"emerald","placeholder":"May revenue tracking 12% over target"},
    {"key":"sales","label":"Sales Quick Pulse","emoji":"💼","time_min":5,"owner":"Stefan","accent":"blue","placeholder":"New commercial bid sent to Hilltop HOA"},
    {"key":"operations","label":"Operations Quick Pulse","emoji":"🏗️","time_min":10,"owner":"Ivana","accent":"purple","placeholder":"Sub crew unavailable Thursday — need backup"},
    {"key":"field","label":"Field / Installation Quick Pulse","emoji":"🚜","time_min":5,"owner":"Maximilian","accent":"orange","placeholder":"Trimmer #2 needs blade replacement"},
    {"key":"blocker","label":"Issues & Blockers","emoji":"🚧","time_min":10,"owner":"All","accent":"red","placeholder":"Vendor delivery delay on putting-green turf","wants_owner":true},
    {"key":"action_item","label":"Commitments & Action Items","emoji":"✅","time_min":4,"owner":"All","accent":"zinc","placeholder":"Decide on vehicle-wrap design by next Friday","wants_owner":true,"wants_due":true,"is_action":true},
    {"key":"week_ahead","label":"Week Ahead Planning","emoji":"📅","time_min":10,"owner":"All","accent":"indigo","placeholder":"Two new installs scheduled Mon & Wed"}
  ]'::jsonb
)
on conflict (slug) do nothing;
