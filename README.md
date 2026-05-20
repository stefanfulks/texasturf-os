# TexasTurf OS

Internal command center for TexasTurf. Replaces overloaded Monday boards with
a focused tool that office staff actually want to use. Jobber stays as the
client-facing billing/comms tool; Notion stays for SOPs and docs.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase
(Postgres + Auth) · Vercel · Sentry · PostHog · Resend.

## v1 scope

| Module | Status |
| --- | --- |
| Fleet & Equipment | In progress — first module |
| Pricing tools | Phase 2 (port from Base44) |
| Installer job updates | Phase 2 (Jobber API integration) |
| Inventory | Phase 3 (port from Base44) |
| Invoice approval | Phase 3 |
| Internal ops / SEO tracking | Phase 4 |

Office staff are the primary v1 user. Desktop-first. Mobile comes after.

## Local development

```bash
pnpm install
cp .env.example .env.local   # then fill in real values
pnpm dev
```

App runs at http://localhost:3000. Sign in with a `@texasturfusa.com` email.
Supabase emails a magic link.

## Supabase schema

Migrations live in `supabase/migrations/`. To apply them to the project DB:

1. Until the Supabase CLI is wired up, paste the contents of each migration
   file into Supabase dashboard → SQL editor → run.
2. Once the CLI is wired:
   ```bash
   pnpm supabase db push   # applies pending migrations
   ```

Schema-of-record is in `supabase/migrations/` — never edit tables directly
in the dashboard once we're past v1.

## Auth

Magic link via Supabase Auth, restricted to `@texasturfusa.com` emails in the
server action. Google Workspace SSO will replace this once the GCP OAuth
client is set up.

## Deploys

- `main` deploys to `https://os.texasturfusa.com` on Vercel.
- PRs get preview deployments.

## Environment variables

See `.env.example` for the full list. Production values live in Vercel project
settings, not in this repo.
