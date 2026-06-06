-- TexasTurf OS — Multi-assignee tasks
-- Tasks become @-tag-able. The original tasks.assignee_id stays as the
-- "primary" owner (back-compat with everything that already reads it);
-- task_assignees holds the full set, including the primary.

create table if not exists public.task_assignees (
  task_id    uuid not null references public.tasks(id)    on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_primary boolean not null default false,
  added_by   uuid references public.profiles(id) on delete set null,
  added_at   timestamptz not null default now(),
  primary key (task_id, profile_id)
);

create index if not exists task_assignees_profile_idx
  on public.task_assignees (profile_id);
create index if not exists task_assignees_task_idx
  on public.task_assignees (task_id);

-- Backfill: every existing tasks.assignee_id becomes a primary row.
insert into public.task_assignees (task_id, profile_id, is_primary, added_by, added_at)
select id, assignee_id, true, created_by_id, created_at
from public.tasks
where assignee_id is not null
on conflict (task_id, profile_id) do update set is_primary = true;

-- Keep task_assignees and tasks.assignee_id in sync going forward. If app
-- code only updates tasks.assignee_id, this trigger ensures the join table
-- still reflects the new primary.
create or replace function public.sync_task_primary_assignee()
returns trigger
language plpgsql
as $$
begin
  if new.assignee_id is null then
    return new;
  end if;

  -- Demote any previous primary on assignee change.
  if tg_op = 'UPDATE' and old.assignee_id is distinct from new.assignee_id then
    update public.task_assignees
      set is_primary = false
      where task_id = new.id and is_primary = true;
  end if;

  insert into public.task_assignees (task_id, profile_id, is_primary, added_by)
  values (
    new.id,
    new.assignee_id,
    true,
    coalesce(new.created_by_id, new.assignee_id)
  )
  on conflict (task_id, profile_id) do update set is_primary = true;

  return new;
end;
$$;

drop trigger if exists sync_task_primary_assignee_trg on public.tasks;
create trigger sync_task_primary_assignee_trg
  after insert or update of assignee_id on public.tasks
  for each row execute function public.sync_task_primary_assignee();

-- RLS — mirror the tasks-table policy so a user who can see a task can see
-- who's tagged on it, and a user who can write the task can edit the tags.
alter table public.task_assignees enable row level security;

drop policy if exists "task_assignees select" on public.task_assignees;
create policy "task_assignees select"
  on public.task_assignees for select
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          t.assignee_id   = auth.uid()
          or t.created_by_id = auth.uid()
          or t.visibility in ('team', 'public')
          or public.current_role() in ('admin', 'office')
        )
    )
  );

drop policy if exists "task_assignees write" on public.task_assignees;
create policy "task_assignees write"
  on public.task_assignees for all
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          t.assignee_id   = auth.uid()
          or t.created_by_id = auth.uid()
          or public.current_role() in ('admin', 'office')
        )
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          t.assignee_id   = auth.uid()
          or t.created_by_id = auth.uid()
          or public.current_role() in ('admin', 'office')
        )
    )
  );
