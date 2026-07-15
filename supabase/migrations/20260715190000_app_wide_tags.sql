-- App-wide tags: one shared registry (tags) + a polymorphic link (entity_tags).
-- entity_id is TEXT so it spans uuid PKs (sales_contacts, deals, tasks, jobs,
-- invoices) and Jobber's text PKs (jobber_clients). Polymorphic => no FK to the
-- target rows; orphan cleanup is handled in app logic, not a cascade.

do $$ begin
  create type public.taggable_entity as enum (
    'sales_contact', 'jobber_client', 'deal', 'task', 'job', 'project', 'invoice'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  color      text not null default 'slate',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.entity_tags (
  id          uuid primary key default gen_random_uuid(),
  tag_id      uuid not null references public.tags(id) on delete cascade,
  entity_type public.taggable_entity not null,
  entity_id   text not null,
  tagged_by   uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  constraint entity_tags_unique unique (tag_id, entity_type, entity_id)
);

create index if not exists entity_tags_entity_idx on public.entity_tags(entity_type, entity_id);
create index if not exists entity_tags_tag_idx     on public.entity_tags(tag_id);

alter table public.tags        enable row level security;
alter table public.entity_tags enable row level security;

-- Internal team tool: any authenticated user has full access (mirrors sales module).
drop policy if exists tags_authd        on public.tags;
drop policy if exists entity_tags_authd on public.entity_tags;
create policy tags_authd        on public.tags        for all to authenticated using (true) with check (true);
create policy entity_tags_authd on public.entity_tags for all to authenticated using (true) with check (true);
