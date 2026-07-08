-- Editable content blocks — a lightweight CMS. Stores ONLY overrides: every
-- block has an in-code default (src/lib/content/registry.ts), so a missing row
-- means "use the default". Team members read (content renders for everyone);
-- admins write. Additive only.

create table if not exists public.content_blocks (
  key        text primary key,
  value      text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.content_blocks enable row level security;

-- Read: any authenticated user (content is shown across the app).
drop policy if exists content_blocks_auth_read on public.content_blocks;
create policy content_blocks_auth_read on public.content_blocks
  for select to authenticated using (true);

-- Write: admins only.
drop policy if exists content_blocks_admin_write on public.content_blocks;
create policy content_blocks_admin_write on public.content_blocks
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
