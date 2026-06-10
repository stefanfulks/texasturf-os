# Supabase

Schema-of-record for TexasTurf OS. Migrations under `migrations/` are the only
sanctioned way to change the database.

## Applying migrations (until the CLI is wired up)

For each new file in `migrations/`, in timestamp order:

1. Open Supabase dashboard → SQL Editor.
2. Paste the file contents.
3. Run.
4. Confirm it succeeded (no red error banner).

These migrations are idempotent (`if not exists`, `do $$ begin ... exception when duplicate_object then null; end $$;`),
so re-running won't corrupt the schema, but it's wasteful — track what's been
applied externally for now.

## Future: Supabase CLI

When ready:

```bash
brew install supabase/tap/supabase   # or download a release
supabase login
supabase link --project-ref ybedvthhofoutbqgwnvm
supabase db push
```

Then migrations apply via `supabase db push` from this repo.

> **Project identity (verified 2026-06-10):** the live app project is
> **`ybedvthhofoutbqgwnvm`** ("texasturf os") — confirmed against the production
> JS bundle and live session cookies at os.texasturfusa.com.
> `htyxspaorzyvihrfxpia` ("texasturf-command-center") is a **separate
> Jobber-related project** — never point the app, the CLI link, or `pnpm typegen`
> at it. Type regen (`pnpm typegen`) pins `--project-id ybedvthhofoutbqgwnvm`
> explicitly, so it works regardless of link state.
