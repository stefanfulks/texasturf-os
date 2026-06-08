# TexasTurf OS — Agent Operating Contract

This file is the operating contract for every Claude Code session in this repo. These rules **OVERRIDE** default behavior and must be followed exactly.

`CLAUDE.md` includes this file via `@AGENTS.md` at the top, then adds repo-specific notes (verified commands, integrations wired). Rules belong here; per-repo notes belong there.

---

## 1. Next.js 16 — read the docs before writing

This is **Next.js 16** with **React 19** (App Router, Server Actions, route groups). Many APIs and conventions have changed from the version you were trained on. Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

## 2. Verification — no claim without a real exit code

Never claim build/typecheck/lint/migration/deploy is "clean", "passing", or "ready" without running the command and showing its actual exit code or success line:

- **Typecheck:** `pnpm typecheck` must exit `0`.
- **Lint:** `pnpm lint` must exit `0`.
- **Build:** `pnpm build` must complete with no error.
- **Migration applied:** `supabase migration list` shows the new file under the **Remote** column.
- **Types regenerated:** `git diff src/lib/database.types.ts --stat` shows the change.
- **Deploy:** check Vercel — don't claim "deploy succeeded" from a `git push` alone.

"Mostly works" = "doesn't work yet." If you didn't run the command this turn, say so explicitly.

See `/verify` for the explicit invocation.

## 3. Secrets — never in chat, never echoed

- Never paste secret values into chat. Reference by env-var name only.
- `.env.local` and `.env.production` are gitignored — confirm they stay that way.
- If the user accidentally pastes a secret in chat, tell them to rotate it.
- To add a secret to Vercel from the terminal, pipe it: `printf '%s' "<value>" | vercel env add NAME production`. Never `echo` a secret.

## 4. Scope — never bundle, ship one thing end-to-end

For any request with 3+ deliverables, write a numbered checklist, confirm the sequence with the user, then implement item 1 fully (code → typecheck → commit → deploy) before starting item 2.

Bundling blows the output-token limit and loses the session. See `/scope`.

## 5. Database — Supabase native, DDL on the direct connection only

This project uses Supabase directly. There is **no Prisma**. Migrations live in `supabase/migrations/<timestamp>_<name>.sql`. Generated types live in `src/lib/database.types.ts` and **are imported by app code** — they MUST be regenerated after every schema change or typecheck will lie.

- **DDL goes through the direct connection (port 5432)** — `DIRECT_URL` / `SUPABASE_DB_URL`. The **transaction pooler (port 6543)** silently swallows DDL.
- **Apply migrations via `supabase db push`** (CLI authenticated + linked). Until the CLI is wired, the dashboard SQL Editor path documented in `supabase/README.md` is the fallback.
- **Regenerate types every migration:** `pnpm exec supabase gen types typescript --linked > src/lib/database.types.ts`.
- **Destructive DDL needs explicit approval** — `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... TYPE`, `TRUNCATE`, enum value renames. Surface what data is at risk and offer a safer path (additive migration + backfill + later cleanup) first.
- **Enum value renames:** never use a regular migration that drops/recreates the type — that destroys column data. Write `ALTER TYPE "X" RENAME VALUE 'OLD' TO 'NEW';` as its own migration.

See `/migrate` for the full pipeline.

## 6. RLS — always on, the model never bypasses it

Every Supabase table this app touches has RLS policies. Server actions and API routes use the user-context Supabase client (`@/lib/supabase/server`) so RLS applies. The **service-role key never appears in code paths the user reaches** — it's reserved for trusted backfills/cron and must be in `lib/supabase/admin.ts` style modules that explicit `await` an auth check.

When adding a new tool to the Turfy assistant or a new server action, default to the user-context client. Service role is opt-in, called out in the diff, and reviewed.

## 7. Git — careful by default, never destructive without authorization

- The remote must be `https://github.com/stefanfulks/texasturf-os.git`. Verify with `git remote get-url origin` before any push.
- Default branch is `main`. If on another branch, ask before pushing — don't assume.
- Stage specific files (`git add path/to/file`) — never `git add -A` or `git add .` (risks staging secrets or stray files).
- Conventional Commits style — `feat(...)`, `fix(...)`, `refactor(...)`, `chore(...)` — matching the project's `git log --oneline -10` pattern.
- No `Co-Authored-By: Claude` trailer unless the user opts in for the specific commit.
- Always create **new** commits — never `--amend` a commit you didn't make this turn. A pre-commit hook failure means the commit did NOT happen.
- Never force-push without explicit per-action approval. Never force-push to `main`.
- Never `--no-verify` or skip hooks.
- **Standing authorization:** push and let Vercel auto-deploy after every committed feature change unless told otherwise. Anything destructive still requires explicit per-action approval.

## 8. Package manager — pnpm only

This repo uses pnpm. Use it consistently:

- `pnpm install` — never `npm install` or `yarn`.
- `pnpm add <pkg>` to add a dep.
- `pnpm exec <bin>` to run a project-local bin (e.g., `pnpm exec supabase ...`).
- Project scripts: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`.

Mixing managers will corrupt `pnpm-lock.yaml` and break installs in CI/Vercel.

---

## Domain quick-reference

- **Business:** TexasTurf — turf installation. Domain: `texasturfusa.com`. Owner: Stefan Fulks (`stefan@texasturfusa.com`).
- **Repo:** `stefanfulks/texasturf-os`. Branch: `main`. Hosting: Vercel (auto-deploys main). DB: Supabase. Errors: Sentry. Analytics: PostHog. Email: Resend.
- **Departments:** Sales / Warehouse / Office / Field / Marketing / Financial.
- **Roles:** admin / office / field.
- **Modules already shipped:** Fleet, Tasks (multi-assignee, subtasks, mentions), Projects, Notifications, Recurring tasks, Invoices (with OCR), Reports, Team performance, Inventory (rolls, jobs, pulls), Jobber sync (clients, jobs, visits, webhooks), Warehouse storage, Meetings, App feedback.
- **Tools that stay outside this app:** Jobber (client billing/scheduling/comms — synced in, not replaced), Slack (internal chat), Notion (SOPs — assistant deep-links via `search_notion_sops`), Google Drive (docs).
- **AI assistant:** "**Turfy**" — Claude embedded at `src/app/(app)/assistant/` with read tools at `src/lib/assistant/tools.ts`. RLS-enforced, read-only for v1. Write tools (create task, schedule, Slack) are the planned expansion and MUST always render a confirm card before executing.

---

## Custom skills

Defined in `.claude/skills/<name>/SKILL.md` (this dir is gitignored — skills are local to each contributor's setup):

- **`/preflight`** — repo/branch/DB/CLI/MCP sanity checks before deploy or migration.
- **`/migrate`** — apply a Supabase migration via direct connection + regen types + typecheck.
- **`/ship`** — typecheck + lint + commit + push (no schema).
- **`/verify`** — proof-first mode: every success claim requires an exit code or success line.
- **`/scope`** — split a big request into a numbered checklist, ship one item at a time.
- **`/feature`** — full pipeline: implement → typecheck → lint → commit → push → confirm Vercel.
- **`/integrate`** — real provider setup with a real test event + receipt confirmation.
- **`/audit-fleet`** — coordinator + parallel workers in git worktrees for production-readiness audits.

`/feature` and `/ship` enforce the verification discipline in §2. `/migrate` enforces the DDL rules in §5.
