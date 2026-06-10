@AGENTS.md

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16.x) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# texasturf-os

Next.js 16 + Supabase (SSR) + Sentry + PostHog. pnpm. Deploys to Vercel from `main`.

## Verified commands (use these exact ones — don't guess)
- `pnpm dev` — local dev server
- `pnpm typecheck` — `tsc --noEmit`, must exit 0 before shipping
- `pnpm lint` — eslint, must exit 0 before shipping
- `pnpm build` — production build (Sentry source-map upload happens here)
- `supabase db push` — apply pending migrations (uses direct connection, NOT pooler — pooler silently blocks DDL)
- `pnpm typegen` — regen DB types after a migration (fully overwrites `src/lib/database.types.ts`; hand-curated aliases live in `src/lib/db-helpers.types.ts` and survive regen)

## Integrations wired in this repo
Jobber (OAuth + GraphQL sync + webhooks), Slack (bot + invoices), Monday (3 boards), Google (Calendar + OAuth), Resend (email), Sentry, PostHog, OpenAI (OCR + assistant). Secrets live in `.env.local` (gitignored). Schema for required keys: `.env.example`.

## Workflows
- `/ship` — verify-then-commit-then-push. Never claim shipped without it.
- `/migrate` — apply a new Supabase migration safely.
- `/preflight` — pre-flight infra checks at session start.
