-- TexasTurf OS — Phase 2: Task Manager
-- Adds: departments, tasks, task_comments, task_activity
-- Idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.task_status as enum (
    'inbox', 'in_progress', 'waiting', 'blocked', 'done', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_visibility as enum ('private', 'team', 'public');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────
-- Departments
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.departments (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

insert into public.departments (name, description) values
  ('Office / Dispatch',  'Administrative and dispatch coordination'),
  ('Installation',       'Field installation teams'),
  ('Warehouse',          'Materials, inventory, and equipment prep'),
  ('Marketing',          'Marketing, content, social, and SEO'),
  ('Sales',              'Residential and commercial sales'),
  ('Pickup',             'Customer pickup coordination')
on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- Extend profiles
-- ─────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists title         text,
  add column if not exists avatar_url    text;

-- ─────────────────────────────────────────────────────────────────────
-- Tasks
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  status         public.task_status    not null default 'inbox',
  priority       public.task_priority  not null default 'normal',
  assignee_id    uuid not null references public.profiles(id),
  created_by_id  uuid not null references public.profiles(id),
  -- project_id will be added as a FK once the projects table exists
  project_id     uuid,
  department_id  uuid references public.departments(id),
  due_date       date,
  start_date     date,
  completed_at   timestamptz,
  blocked_reason text,
  visibility     public.task_visibility not null default 'private',
  tags           text[] not null default '{}',
  monday_item_id text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists tasks_assignee_idx   on public.tasks (assignee_id);
create index if not exists tasks_created_by_idx on public.tasks (created_by_id);
create index if not exists tasks_status_idx     on public.tasks (status);
create index if not exists tasks_due_date_idx   on public.tasks (due_date);
create index if not exists tasks_project_idx    on public.tasks (project_id);

-- ─────────────────────────────────────────────────────────────────────
-- Task comments
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id),
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_comments_task_idx on public.task_comments (task_id);

-- ─────────────────────────────────────────────────────────────────────
-- Task activity log
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.task_activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  actor_id   uuid not null references public.profiles(id),
  event_type text not null,   -- 'created' | 'status_changed' | 'priority_changed' | 'due_date_changed' | 'assigned' | 'completed' | 'commented'
  old_value  text,
  new_value  text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index if not exists task_activity_task_idx on public.task_activity (task_id);
create index if not exists task_activity_time_idx on public.task_activity (created_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- updated_at triggers (reuses touch_updated_at from init_fleet)
-- ─────────────────────────────────────────────────────────────────────

drop trigger if exists touch_tasks on public.tasks;
create trigger touch_tasks before update on public.tasks
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_task_comments on public.task_comments;
create trigger touch_task_comments before update on public.task_comments
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────

alter table public.departments   enable row level security;
alter table public.tasks         enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity enable row level security;

-- Departments: all authenticated users can read; only admin can write
drop policy if exists "departments select" on public.departments;
create policy "departments select" on public.departments
  for select to authenticated using (true);

drop policy if exists "departments admin write" on public.departments;
create policy "departments admin write" on public.departments
  for all to authenticated
  using  (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Tasks: owner/assignee always see their tasks; team/public visibility opens to others; admin/office sees all
drop policy if exists "tasks select" on public.tasks;
create policy "tasks select" on public.tasks
  for select to authenticated
  using (
    created_by_id = auth.uid()
    or assignee_id = auth.uid()
    or visibility = 'public'
    or visibility = 'team'
    or public.current_role() in ('admin', 'office')
  );

drop policy if exists "tasks insert" on public.tasks;
create policy "tasks insert" on public.tasks
  for insert to authenticated
  with check (created_by_id = auth.uid());

drop policy if exists "tasks update" on public.tasks;
create policy "tasks update" on public.tasks
  for update to authenticated
  using (
    created_by_id = auth.uid()
    or assignee_id = auth.uid()
    or public.current_role() in ('admin', 'office')
  );

drop policy if exists "tasks delete" on public.tasks;
create policy "tasks delete" on public.tasks
  for delete to authenticated
  using (
    created_by_id = auth.uid()
    or public.current_role() = 'admin'
  );

-- Comments: creator sees their own; admin/office sees all; task visibility is enforced at app level
drop policy if exists "task_comments select" on public.task_comments;
create policy "task_comments select" on public.task_comments
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'office')
  );

drop policy if exists "task_comments insert" on public.task_comments;
create policy "task_comments insert" on public.task_comments
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "task_comments update" on public.task_comments;
create policy "task_comments update" on public.task_comments
  for update to authenticated
  using (user_id = auth.uid());

drop policy if exists "task_comments delete" on public.task_comments;
create policy "task_comments delete" on public.task_comments
  for delete to authenticated
  using (user_id = auth.uid() or public.current_role() = 'admin');

-- Activity: creator sees their own events; admin/office sees all
drop policy if exists "task_activity select" on public.task_activity;
create policy "task_activity select" on public.task_activity
  for select to authenticated
  using (
    actor_id = auth.uid()
    or public.current_role() in ('admin', 'office')
  );

drop policy if exists "task_activity insert" on public.task_activity;
create policy "task_activity insert" on public.task_activity
  for insert to authenticated
  with check (actor_id = auth.uid());
