-- TexasTurf OS — Phase 2: Projects
-- Adds: project_status, project_type enums, projects, project_members tables
-- Adds FK from tasks → projects (was deferred in init_tasks)
-- Idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.project_status as enum (
    'intake', 'planning', 'waiting_customer', 'waiting_internal',
    'scheduled', 'in_progress', 'blocked', 'ready_for_review',
    'complete', 'on_hold', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_type as enum (
    'customer_install', 'commercial_bid', 'sales_marketing',
    'operations', 'warehouse', 'admin', 'strategic', 'warranty', 'technology'
  );
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────
-- Projects
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  type                public.project_type   not null default 'customer_install',
  status              public.project_status not null default 'intake',
  priority            public.task_priority  not null default 'normal',
  owner_id            uuid not null references public.profiles(id),
  department_id       uuid references public.departments(id),
  customer_name       text,
  address             text,
  description         text,
  start_date          date,
  due_date            date,
  target_install_date date,
  jobber_url          text,
  monday_item_id      text,
  slack_channel_id    text,
  archived            boolean not null default false,
  created_by_id       uuid not null references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists projects_owner_idx      on public.projects (owner_id);
create index if not exists projects_status_idx     on public.projects (status);
create index if not exists projects_department_idx on public.projects (department_id);

-- ─────────────────────────────────────────────────────────────────────
-- Project members
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id),
  role       text not null default 'member',  -- 'owner' | 'member' | 'viewer'
  added_at   timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists project_members_project_idx on public.project_members (project_id);
create index if not exists project_members_user_idx    on public.project_members (user_id);

-- ─────────────────────────────────────────────────────────────────────
-- Wire up tasks → projects FK (deferred from init_tasks)
-- ─────────────────────────────────────────────────────────────────────

do $$ begin
  alter table public.tasks
    add constraint tasks_project_id_fkey
    foreign key (project_id) references public.projects(id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists tasks_project_id_idx on public.tasks (project_id);

-- ─────────────────────────────────────────────────────────────────────
-- updated_at trigger for projects
-- ─────────────────────────────────────────────────────────────────────

drop trigger if exists touch_projects on public.projects;
create trigger touch_projects before update on public.projects
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────

alter table public.projects        enable row level security;
alter table public.project_members enable row level security;

-- Projects: owner/member always sees their project; admin/office sees all
drop policy if exists "projects select" on public.projects;
create policy "projects select" on public.projects
  for select to authenticated
  using (
    owner_id = auth.uid()
    or created_by_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = id and pm.user_id = auth.uid()
    )
    or public.current_role() in ('admin', 'office')
  );

drop policy if exists "projects insert" on public.projects;
create policy "projects insert" on public.projects
  for insert to authenticated
  with check (created_by_id = auth.uid());

drop policy if exists "projects update" on public.projects;
create policy "projects update" on public.projects
  for update to authenticated
  using (
    owner_id = auth.uid()
    or created_by_id = auth.uid()
    or public.current_role() in ('admin', 'office')
  );

drop policy if exists "projects delete" on public.projects;
create policy "projects delete" on public.projects
  for delete to authenticated
  using (
    created_by_id = auth.uid()
    or public.current_role() = 'admin'
  );

-- Project members: visible to project members and admin
drop policy if exists "project_members select" on public.project_members;
create policy "project_members select" on public.project_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.owner_id = auth.uid() or p.created_by_id = auth.uid())
    )
    or public.current_role() in ('admin', 'office')
  );

drop policy if exists "project_members insert" on public.project_members;
create policy "project_members insert" on public.project_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.owner_id = auth.uid() or p.created_by_id = auth.uid())
    )
    or public.current_role() in ('admin', 'office')
  );

drop policy if exists "project_members delete" on public.project_members;
create policy "project_members delete" on public.project_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'office')
  );
