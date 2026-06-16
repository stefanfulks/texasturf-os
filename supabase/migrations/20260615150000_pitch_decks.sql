-- Pitch decks: named, ordered slide sequences for the sales-deck builder.
-- A deck owns its slides inline (jsonb array of StoredSlide {id,kind,hidden,...content}).
-- The default deck is seeded from code (ensureDefaultDeck) to stay DRY with src/lib/pitch/deck.ts.
-- Additive + idempotent.

create table if not exists public.pitch_decks (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  service_line text,
  slides       jsonb not null default '[]'::jsonb,   -- ordered StoredSlide[]
  is_default   boolean not null default false,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- At most one default deck.
create unique index if not exists pitch_decks_one_default on public.pitch_decks (is_default) where is_default;

-- Each session remembers which deck it presented.
do $$ begin
  alter table public.pitch_sessions add column deck_id uuid references public.pitch_decks(id) on delete set null;
exception when duplicate_column then null; end $$;

alter table public.pitch_decks enable row level security;

-- Internal team tool: any authenticated user (mirrors pitch_sessions / deals).
drop policy if exists pitch_decks_authd on public.pitch_decks;
create policy pitch_decks_authd on public.pitch_decks for all to authenticated using (true) with check (true);
