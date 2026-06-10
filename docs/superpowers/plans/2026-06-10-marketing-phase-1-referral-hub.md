# Marketing Phase 1 — Referral Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the referral campaign hub end-to-end: 4 marketing tables + RLS, roster built from synced Jobber clients, call-outcome logging, referral ledger with reward flips, Reevo CSV export, live Marketing workspace nav, real dashboard stats.

**Architecture:** One additive Supabase migration (all 4 marketing tables ship now; content/campaign UIs come in Phases 2–3). Pages under `src/app/(app)/marketing/` follow the repo's server-component + server-actions pattern with RLS as the write gate (`user_is_marketing()` helper: admin or marketing department). No new infra: Reevo gets a CSV, Jobber copy lives as campaign data, video files stay in Drive/YouTube.

**Tech Stack:** Next.js 16 (App Router, React 19), Supabase (SSR client `@/lib/supabase/server`), Tailwind 4, Lucide icons, zod, pnpm. Deploys to Vercel from `main`.

**Repo-contract notes (AGENTS.md overrides defaults):**
- No test framework exists in this repo; verification per AGENTS.md §2 = `pnpm typecheck` exit 0 + `pnpm lint` exit 0 after every task, `supabase migration list` for the migration, Vercel check for deploy. TDD steps are replaced by typecheck/verify steps deliberately.
- Work happens directly on `main` (Vercel auto-deploys main; standing authorization to push committed feature work). No worktree.
- Conventional commits, stage specific files only, **no Co-Authored-By trailer**.
- Spec: `docs/superpowers/specs/2026-06-10-marketing-section-design.md`.

**Verified ground truth used below:**
- `jobber_clients`: `id text pk`, `first_name`, `last_name`, `company_name`, `is_archived bool`, `phones jsonb` = `[{number, description, primary}]`, `emails jsonb` = `[{address, description, primary}]`.
- `jobber_jobs`: `id text pk`, `client_id text null`, `status text null`, `completed_at timestamptz null`, `title`, `job_number`, `total_cents`.
- `profiles`: `role` enum `user_role` (admin/office/field), `departments user_department[]` (includes `marketing`).
- Helpers that already exist in DB: `public.current_role()`, `public.touch_updated_at()`.
- Enum creation idiom: `do $$ begin create type ... exception when duplicate_object then null; end $$;`.
- CSV street/city omitted (client addresses aren't in the mirror's typed columns — Reevo import maps available fields; revisit if needed).

---

### Task 1: Migration — marketing core tables + RLS + seed

**Files:**
- Create: `supabase/migrations/20260610200000_marketing_core.sql`
- Regenerate: `src/lib/database.types.ts`

- [ ] **Step 1.1: Run `/preflight` checks** (repo skill): git remote is `stefanfulks/texasturf-os`, branch `main`, Supabase CLI linked, direct connection available. Stop if any fail.

- [ ] **Step 1.2: Write the migration file** with this exact content:

```sql
-- TexasTurf OS — Marketing core (Phase 1 of marketing section)
-- Spec: docs/superpowers/specs/2026-06-10-marketing-section-design.md
-- campaigns + referral_outreach (call roster) + referrals (ledger) + content_items.
-- content_items ships now (schema complete); its UI arrives in Phase 2.

-- ─── Enums ───────────────────────────────────────────────────────────────────

do $$ begin
  create type public.campaign_type as enum
    ('referral', 'service_spotlight', 'seasonal', 'event', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum
    ('draft', 'active', 'paused', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.outreach_segment as enum ('residential', 'b2b_partner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.outreach_call_status as enum
    ('queued', 'no_answer', 'declined', 'referred', 'do_not_call', 'invalid_number');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.referral_source as enum
    ('call', 'jobber_link', 'word_of_mouth', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.referral_stage as enum
    ('lead', 'contacted', 'quoted', 'signed', 'completed_paid', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.referral_reward_type as enum
    ('visa_250', 'care_plan_1yr', 'undecided');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.referral_reward_status as enum ('not_earned', 'due', 'sent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_item_type as enum
    ('long_video', 'short', 'pov_clip', 'before_after', 'photo_set', 'blog_post', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_item_status as enum
    ('idea', 'scripted', 'scheduled_shoot', 'filmed', 'editing', 'ready', 'published', 'archived');
exception when duplicate_object then null; end $$;

-- ─── Access helper ───────────────────────────────────────────────────────────

create or replace function public.user_is_marketing()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.current_role() = 'admin'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and 'marketing' = any(p.departments)
    );
$$;

-- ─── campaigns ───────────────────────────────────────────────────────────────

create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  type          public.campaign_type   not null default 'other',
  status        public.campaign_status not null default 'draft',
  brief_md      text,
  -- [{label, subject, body}] — copy blocks pasted into Jobber manually.
  jobber_copy   jsonb not null default '[]'::jsonb,
  -- [{channel, planned_on, done_at}] — manual channel checklist.
  channels      jsonb not null default '[]'::jsonb,
  service_line  text,
  starts_on     date,
  ends_on       date,
  results       jsonb not null default '{}'::jsonb,
  created_by_id uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists campaigns_status_idx on public.campaigns (status);

drop trigger if exists touch_campaigns on public.campaigns;
create trigger touch_campaigns before update on public.campaigns
  for each row execute function public.touch_updated_at();

-- ─── referral_outreach (call roster) ─────────────────────────────────────────
-- jobber_client_id intentionally has NO foreign key: jobber_clients is a
-- sync-owned mirror (rows may be re-written by sync). We snapshot the fields
-- the callers need at roster-build time.

create table if not exists public.referral_outreach (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.campaigns(id) on delete cascade,
  jobber_client_id  text not null,
  client_name       text not null,
  client_phone      text,
  client_email      text,
  last_job_note     text,
  segment           public.outreach_segment     not null default 'residential',
  owner_id          uuid references public.profiles(id) on delete set null,
  call_status       public.outreach_call_status not null default 'queued',
  attempts          int  not null default 0,
  last_called_at    timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (campaign_id, jobber_client_id)
);

create index if not exists referral_outreach_campaign_status_idx
  on public.referral_outreach (campaign_id, call_status);
create index if not exists referral_outreach_owner_idx
  on public.referral_outreach (owner_id) where owner_id is not null;

drop trigger if exists touch_referral_outreach on public.referral_outreach;
create trigger touch_referral_outreach before update on public.referral_outreach
  for each row execute function public.touch_updated_at();

-- ─── referrals (ledger) ──────────────────────────────────────────────────────

create table if not exists public.referrals (
  id                         uuid primary key default gen_random_uuid(),
  campaign_id                uuid references public.campaigns(id) on delete set null,
  outreach_id                uuid references public.referral_outreach(id) on delete set null,
  referrer_jobber_client_id  text,
  referrer_name              text not null,
  source                     public.referral_source not null default 'call',
  referred_name              text not null,
  referred_phone             text,
  referred_email             text,
  service_interest           text,
  stage                      public.referral_stage         not null default 'lead',
  reward_type                public.referral_reward_type   not null default 'undecided',
  reward_status              public.referral_reward_status not null default 'not_earned',
  reward_sent_at             timestamptz,
  reward_note                text,
  jobber_quote_url           text,
  jobber_job_url             text,
  notes                      text,
  created_by_id              uuid references public.profiles(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists referrals_stage_idx  on public.referrals (stage);
create index if not exists referrals_reward_idx on public.referrals (reward_status);
create index if not exists referrals_campaign_idx
  on public.referrals (campaign_id) where campaign_id is not null;

drop trigger if exists touch_referrals on public.referrals;
create trigger touch_referrals before update on public.referrals
  for each row execute function public.touch_updated_at();

-- ─── content_items (schema now, UI in Phase 2) ───────────────────────────────

create table if not exists public.content_items (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  type               public.content_item_type   not null default 'other',
  status             public.content_item_status not null default 'idea',
  service_line       text,
  creator_id         uuid references public.profiles(id) on delete set null,
  drive_url          text,
  youtube_url        text,
  published_channels jsonb not null default '[]'::jsonb,
  hook               text,
  job_ref            text,
  shot_on            date,
  published_on       date,
  created_by_id      uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists content_items_status_idx on public.content_items (status);
create index if not exists content_items_service_idx
  on public.content_items (service_line) where service_line is not null;

drop trigger if exists touch_content_items on public.content_items;
create trigger touch_content_items before update on public.content_items
  for each row execute function public.touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Reads: any authenticated user (internal ops data, not client-sensitive).
-- Writes: admin or marketing department, via user_is_marketing().

alter table public.campaigns         enable row level security;
alter table public.referral_outreach enable row level security;
alter table public.referrals         enable row level security;
alter table public.content_items     enable row level security;

drop policy if exists "campaigns select" on public.campaigns;
create policy "campaigns select" on public.campaigns
  for select to authenticated using (true);
drop policy if exists "campaigns marketing write" on public.campaigns;
create policy "campaigns marketing write" on public.campaigns
  for all to authenticated
  using (public.user_is_marketing()) with check (public.user_is_marketing());

drop policy if exists "referral_outreach select" on public.referral_outreach;
create policy "referral_outreach select" on public.referral_outreach
  for select to authenticated using (true);
drop policy if exists "referral_outreach marketing write" on public.referral_outreach;
create policy "referral_outreach marketing write" on public.referral_outreach
  for all to authenticated
  using (public.user_is_marketing()) with check (public.user_is_marketing());

drop policy if exists "referrals select" on public.referrals;
create policy "referrals select" on public.referrals
  for select to authenticated using (true);
drop policy if exists "referrals marketing write" on public.referrals;
create policy "referrals marketing write" on public.referrals
  for all to authenticated
  using (public.user_is_marketing()) with check (public.user_is_marketing());

drop policy if exists "content_items select" on public.content_items;
create policy "content_items select" on public.content_items
  for select to authenticated using (true);
drop policy if exists "content_items marketing write" on public.content_items;
create policy "content_items marketing write" on public.content_items
  for all to authenticated
  using (public.user_is_marketing()) with check (public.user_is_marketing());

-- ─── Seed: Referral Thank-You Blitz 2026 ─────────────────────────────────────

insert into public.campaigns (slug, name, type, status, starts_on, brief_md, jobber_copy)
values (
  'referral-blitz-2026',
  'Referral Thank-You Blitz 2026',
  'referral',
  'active',
  '2026-06-15',
  $md$## The offer
Refer someone who becomes a completed, paid TexasTurf project. Choose **$250 Visa gift card** or **1 year of the TexasTurf Care Plan free**. The referred friend gets **$100 off** their project. Reward is earned when the referred job is **completed and the final invoice is paid**. Unlimited referrals; offer never expires. Never the word "insurance" in writing.

## The motion
1. Roster built in this app from synced Jobber clients (completed job + phone).
2. Export CSV -> Reevo list -> Power Dialer sequence (2 attempts max: call -> text -> call in 5 days).
3. Log every outcome here (<=10s per call). "Referred" captures name + phone + interest.
4. Ledger tracks each referral: lead -> quoted -> signed -> completed_paid -> reward sent.
5. Air cover: Jobber announcement email the week calls start (copy below).

## Call opener
"Hey [first name]! This is [caller] with TexasTurf — we did your backyard over on [street] back in [season]. How's it holding up? ... Love to hear it. So the reason I'm calling — we're growing this year mostly through our past clients instead of spending it all on ads. We'd rather pay you than Facebook. If you know anyone wanting turf, a patio, a pickleball court — anything outdoor — and they complete a project with us, you get a $250 Visa gift card or a full year of our Care Plan free. Who comes to mind?"

Full script + objection handling: spec §3.4 (docs/superpowers/specs/2026-06-10-marketing-section-design.md).$md$,
  '[
    {"label":"Announcement email (Jobber Campaigns)","subject":"We''d rather pay you than Facebook","body":"We''re growing through the people who already trust us — our past clients. Refer a friend with any outdoor project (turf, pavers, courts, fencing, concrete, full landscapes). When their project completes: you get $250 or a free year of the TexasTurf Care Plan, and they get $100 off. Reply to this email or text us with a name. — Stefan & the TexasTurf crew"},
    {"label":"Follow-up text (Reevo)","subject":"","body":"Hi [name], it''s [caller] from TexasTurf. Quick recap: know anyone wanting turf, pavers, a sport court, fencing — any outdoor project? When they complete a project with us you get a $250 Visa gift card (or a free year of our Care Plan), and they get $100 off. Just reply with a name & number anytime — this never expires."},
    {"label":"Reward-sent thank-you (Jobber)","subject":"Your $250 is on its way","body":"Thank you for trusting us with your people — that means everything to a crew like ours. Your reward is on its way. Anyone else comes to mind, the offer never expires."}
  ]'::jsonb
)
on conflict (slug) do nothing;
```

- [ ] **Step 1.3: Apply via the repo's `/migrate` flow:** `supabase db push` (direct connection). Expected: `Applying migration 20260610200000_marketing_core.sql... Finished supabase db push.`

- [ ] **Step 1.4: Verify applied:** `supabase migration list` shows `20260610200000` under Remote.

- [ ] **Step 1.5: Regenerate types:** `pnpm exec supabase gen types typescript --linked > src/lib/database.types.ts`, then `git diff src/lib/database.types.ts --stat` shows changes (campaigns/referral_outreach/referrals/content_items present).

- [ ] **Step 1.6: Typecheck:** `pnpm typecheck` → exit 0.

- [ ] **Step 1.7: Commit:**
```bash
git add supabase/migrations/20260610200000_marketing_core.sql src/lib/database.types.ts
git commit -m "feat(marketing): core schema — campaigns, referral roster/ledger, content items + RLS + blitz seed"
```

---

### Task 2: Marketing lib — Jobber JSON helpers + CSV builder

**Files:**
- Create: `src/lib/marketing/jobber-contacts.ts`
- Create: `src/lib/marketing/csv.ts`

- [ ] **Step 2.1: Create `src/lib/marketing/jobber-contacts.ts`:**

```ts
// Helpers for reading contact info out of the jobber_clients mirror's JSON
// columns. Shapes per src/lib/jobber/sync/clients.ts:
//   phones: { number, description, primary }[]
//   emails: { address, description, primary }[]

type JobberPhone = { number?: unknown; description?: unknown; primary?: unknown };
type JobberEmail = { address?: unknown; description?: unknown; primary?: unknown };

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Primary phone number, falling back to the first one with digits. */
export function primaryPhone(phones: unknown): string | null {
  const list = asArray(phones) as JobberPhone[];
  const pick =
    list.find((p) => p?.primary === true && typeof p.number === "string") ??
    list.find((p) => typeof p?.number === "string" && (p.number as string).trim() !== "");
  return pick ? String(pick.number).trim() : null;
}

/** Primary email address, falling back to the first non-empty one. */
export function primaryEmail(emails: unknown): string | null {
  const list = asArray(emails) as JobberEmail[];
  const pick =
    list.find((e) => e?.primary === true && typeof e.address === "string") ??
    list.find((e) => typeof e?.address === "string" && (e.address as string).trim() !== "");
  return pick ? String(pick.address).trim() : null;
}

/** Display name: "First Last", else company, else the Jobber id. */
export function clientDisplayName(c: {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  id: string;
}): string {
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return person || c.company_name?.trim() || c.id;
}
```

- [ ] **Step 2.2: Create `src/lib/marketing/csv.ts`:**

```ts
// Minimal CSV builder for the Reevo call-list export. RFC4180-style quoting.

export function csvEscape(value: string | null | undefined): string {
  const s = value ?? "";
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | null | undefined)[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return lines.join("\r\n") + "\r\n";
}
```

- [ ] **Step 2.3: Typecheck:** `pnpm typecheck` → exit 0.

- [ ] **Step 2.4: Commit:**
```bash
git add src/lib/marketing/jobber-contacts.ts src/lib/marketing/csv.ts
git commit -m "feat(marketing): jobber contact extraction + csv helpers"
```

---

### Task 3: Server actions — roster build, call logging, ledger, rewards

**Files:**
- Create: `src/app/(app)/marketing/referrals/actions.ts`

- [ ] **Step 3.1: Create `actions.ts`** with this content (RLS enforces marketing-write; actions surface RLS errors as messages):

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clientDisplayName, primaryEmail, primaryPhone } from "@/lib/marketing/jobber-contacts";
import type { Database } from "@/lib/database.types";

export type ActionState = { error: string | null; success: boolean; info?: string };

type OutreachInsert = Database["public"]["Tables"]["referral_outreach"]["Insert"];

const PAGE = 1000;

/**
 * Build (or refresh) the call roster for a campaign from synced Jobber data.
 * Criteria: client not archived, has a phone, and has >=1 job with
 * completed_at set. Existing rows are kept (unique on campaign+client), so
 * re-running only adds newly-eligible clients — call statuses are never reset.
 */
export async function buildRoster(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!campaignId) return { error: "Missing campaign", success: false };

  // 1. All completed jobs -> last completed job per client.
  const lastJobByClient = new Map<string, string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("jobber_jobs")
      .select("client_id, title, job_number, completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { error: `Jobs query failed: ${error.message}`, success: false };
    for (const j of data ?? []) {
      if (!j.client_id) continue;
      const when = j.completed_at ? new Date(j.completed_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
      lastJobByClient.set(j.client_id, [j.title ?? `Job ${j.job_number ?? ""}`, when].filter(Boolean).join(" — "));
    }
    if (!data || data.length < PAGE) break;
  }
  if (lastJobByClient.size === 0) {
    return { error: null, success: true, info: "No completed Jobber jobs found — roster unchanged." };
  }

  // 2. Their client records (skip archived / phoneless).
  const ids = [...lastJobByClient.keys()];
  const rows: OutreachInsert[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabase
      .from("jobber_clients")
      .select("id, first_name, last_name, company_name, phones, emails, is_archived")
      .in("id", chunk);
    if (error) return { error: `Clients query failed: ${error.message}`, success: false };
    for (const c of data ?? []) {
      if (c.is_archived) continue;
      const phone = primaryPhone(c.phones);
      if (!phone) continue;
      rows.push({
        campaign_id: campaignId,
        jobber_client_id: c.id,
        client_name: clientDisplayName(c),
        client_phone: phone,
        client_email: primaryEmail(c.emails),
        last_job_note: lastJobByClient.get(c.id) ?? null,
        // company-name-only records are usually B2B; callers can re-segment in UI
        segment: !c.first_name && !c.last_name && c.company_name ? "b2b_partner" : "residential",
      });
    }
  }

  // 3. Upsert, ignoring clients already on the roster.
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await supabase
      .from("referral_outreach")
      .upsert(chunk, { onConflict: "campaign_id,jobber_client_id", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: `Roster insert failed: ${error.message}`, success: false };
    added += data?.length ?? 0;
  }

  revalidatePath("/marketing/referrals");
  revalidatePath("/marketing");
  return {
    error: null, success: true,
    info: `Roster refreshed: ${added} client${added === 1 ? "" : "s"} added (${rows.length} eligible, existing rows untouched).`,
  };
}

const outcomeSchema = z.object({
  outreach_id: z.string().uuid(),
  call_status: z.enum(["no_answer", "declined", "referred", "do_not_call", "invalid_number", "queued"]),
  notes: z.string().max(2000).optional(),
});

/** Log a call outcome on a roster row (increments attempts, stamps time). */
export async function logCallOutcome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = outcomeSchema.safeParse({
    outreach_id: formData.get("outreach_id"),
    call_status: formData.get("call_status"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { data: row, error: readErr } = await supabase
    .from("referral_outreach")
    .select("attempts, notes")
    .eq("id", parsed.data.outreach_id)
    .single();
  if (readErr || !row) return { error: readErr?.message ?? "Roster row not found", success: false };

  const mergedNotes = [row.notes, parsed.data.notes].filter(Boolean).join("\n");
  const { error } = await supabase
    .from("referral_outreach")
    .update({
      call_status: parsed.data.call_status,
      attempts: row.attempts + (parsed.data.call_status === "queued" ? 0 : 1),
      last_called_at: parsed.data.call_status === "queued" ? null : new Date().toISOString(),
      notes: mergedNotes || null,
      owner_id: user.id,
    })
    .eq("id", parsed.data.outreach_id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/referrals");
  return { error: null, success: true };
}

const referralSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  outreach_id: z.string().uuid().optional(),
  referrer_jobber_client_id: z.string().optional(),
  referrer_name: z.string().min(1, "Referrer name is required"),
  source: z.enum(["call", "jobber_link", "word_of_mouth", "other"]).default("call"),
  referred_name: z.string().min(1, "Referred name is required"),
  referred_phone: z.string().optional(),
  referred_email: z.string().email().optional().or(z.literal("")),
  service_interest: z.string().optional(),
  notes: z.string().optional(),
});

/** Create a ledger entry. When tied to a roster row, marks that row 'referred'. */
export async function createReferral(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = referralSchema.safeParse({
    campaign_id: formData.get("campaign_id") || undefined,
    outreach_id: formData.get("outreach_id") || undefined,
    referrer_jobber_client_id: formData.get("referrer_jobber_client_id") || undefined,
    referrer_name: formData.get("referrer_name"),
    source: formData.get("source") || "call",
    referred_name: formData.get("referred_name"),
    referred_phone: formData.get("referred_phone") || undefined,
    referred_email: formData.get("referred_email") || undefined,
    service_interest: formData.get("service_interest") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  // Guard: self-referral (same phone on both sides) is not eligible.
  if (parsed.data.referred_phone) {
    const { data: outreachRow } = parsed.data.outreach_id
      ? await supabase.from("referral_outreach").select("client_phone").eq("id", parsed.data.outreach_id).single()
      : { data: null };
    const digits = (s: string) => s.replace(/\D/g, "");
    if (outreachRow?.client_phone &&
        digits(outreachRow.client_phone) === digits(parsed.data.referred_phone)) {
      return { error: "Self-referrals aren't eligible (referrer and referred share a phone number).", success: false };
    }
  }

  const { error } = await supabase.from("referrals").insert({
    campaign_id: parsed.data.campaign_id ?? null,
    outreach_id: parsed.data.outreach_id ?? null,
    referrer_jobber_client_id: parsed.data.referrer_jobber_client_id ?? null,
    referrer_name: parsed.data.referrer_name,
    source: parsed.data.source,
    referred_name: parsed.data.referred_name,
    referred_phone: parsed.data.referred_phone ?? null,
    referred_email: parsed.data.referred_email || null,
    service_interest: parsed.data.service_interest ?? null,
    notes: parsed.data.notes ?? null,
    created_by_id: user.id,
  });
  if (error) return { error: error.message, success: false };

  if (parsed.data.outreach_id) {
    const { data: row } = await supabase
      .from("referral_outreach").select("attempts").eq("id", parsed.data.outreach_id).single();
    await supabase.from("referral_outreach").update({
      call_status: "referred",
      attempts: (row?.attempts ?? 0) + 1,
      last_called_at: new Date().toISOString(),
      owner_id: user.id,
    }).eq("id", parsed.data.outreach_id);
  }

  revalidatePath("/marketing/referrals");
  revalidatePath("/marketing");
  return { error: null, success: true, info: "Referral added to the ledger." };
}

const stageSchema = z.object({
  referral_id: z.string().uuid(),
  stage: z.enum(["lead", "contacted", "quoted", "signed", "completed_paid", "lost"]),
});

/**
 * Move a referral through the funnel. Reward flip lives HERE (visible logic,
 * per spec §7.3): entering completed_paid with reward not_earned => due.
 */
export async function updateReferralStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = stageSchema.safeParse({
    referral_id: formData.get("referral_id"),
    stage: formData.get("stage"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { data: ref, error: readErr } = await supabase
    .from("referrals").select("reward_status").eq("id", parsed.data.referral_id).single();
  if (readErr || !ref) return { error: readErr?.message ?? "Referral not found", success: false };

  const flipRewardDue = parsed.data.stage === "completed_paid" && ref.reward_status === "not_earned";
  const { error } = await supabase
    .from("referrals")
    .update({
      stage: parsed.data.stage,
      ...(flipRewardDue ? { reward_status: "due" as const } : {}),
    })
    .eq("id", parsed.data.referral_id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/referrals");
  revalidatePath("/marketing");
  return {
    error: null, success: true,
    info: flipRewardDue ? "Stage updated — reward is now DUE." : "Stage updated.",
  };
}

const rewardSchema = z.object({
  referral_id: z.string().uuid(),
  reward_type: z.enum(["visa_250", "care_plan_1yr", "undecided"]).optional(),
  mark_sent: z.coerce.boolean().optional(),
  override_status: z.enum(["not_earned", "due", "sent"]).optional(),
  reward_note: z.string().max(2000).optional(),
});

/**
 * Reward management. Normal path: set reward_type any time; mark_sent only
 * when status is 'due'. Admin override path: force any status, note required.
 */
export async function updateReward(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = rewardSchema.safeParse({
    referral_id: formData.get("referral_id"),
    reward_type: formData.get("reward_type") || undefined,
    mark_sent: formData.get("mark_sent") || undefined,
    override_status: formData.get("override_status") || undefined,
    reward_note: formData.get("reward_note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { data: ref, error: readErr } = await supabase
    .from("referrals").select("reward_status").eq("id", parsed.data.referral_id).single();
  if (readErr || !ref) return { error: readErr?.message ?? "Referral not found", success: false };

  const update: Record<string, unknown> = {};
  if (parsed.data.reward_type) update.reward_type = parsed.data.reward_type;

  if (parsed.data.override_status) {
    // Admin-only override; RLS allows marketing too, so gate role explicitly.
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return { error: "Only admins can override reward status.", success: false };
    if (!parsed.data.reward_note?.trim()) return { error: "Override requires a note.", success: false };
    update.reward_status = parsed.data.override_status;
    update.reward_note = parsed.data.reward_note.trim();
    update.reward_sent_at = parsed.data.override_status === "sent" ? new Date().toISOString() : null;
  } else if (parsed.data.mark_sent) {
    if (ref.reward_status !== "due") {
      return { error: "Reward can only be marked sent when it is due (job completed + paid).", success: false };
    }
    update.reward_status = "sent";
    update.reward_sent_at = new Date().toISOString();
  }

  if (Object.keys(update).length === 0) return { error: "Nothing to update.", success: false };

  const { error } = await supabase.from("referrals").update(update).eq("id", parsed.data.referral_id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/referrals");
  revalidatePath("/marketing");
  return { error: null, success: true };
}
```

- [ ] **Step 3.2: Typecheck:** `pnpm typecheck` → exit 0.

- [ ] **Step 3.3: Commit:**
```bash
git add "src/app/(app)/marketing/referrals/actions.ts"
git commit -m "feat(marketing): referral server actions — roster build, call outcomes, ledger, reward flips"
```

---

### Task 4: Reevo CSV export route

**Files:**
- Create: `src/app/(app)/marketing/referrals/export/route.ts`

- [ ] **Step 4.1: Create the route handler:**

```ts
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/marketing/csv";

// GET /marketing/referrals/export?campaign=<uuid>
// Downloads the queued + retryable roster rows as a Reevo-importable CSV.
export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaign");
  if (!campaignId) return new Response("Missing ?campaign=<id>", { status: 400 });

  const { data: rows, error } = await supabase
    .from("referral_outreach")
    .select("client_name, client_phone, client_email, last_job_note, segment, call_status")
    .eq("campaign_id", campaignId)
    .in("call_status", ["queued", "no_answer"])
    .order("created_at", { ascending: true });
  if (error) return new Response(`Query failed: ${error.message}`, { status: 500 });

  const csv = toCsv(
    ["first_name", "last_name", "phone", "email", "note", "segment"],
    (rows ?? []).map((r) => {
      const parts = r.client_name.trim().split(/\s+/);
      const first = parts.slice(0, -1).join(" ") || parts[0] || "";
      const last = parts.length > 1 ? parts[parts.length - 1] : "";
      return [first, last, r.client_phone, r.client_email, r.last_job_note, r.segment];
    }),
  );

  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reevo-call-list-${today}.csv"`,
    },
  });
}
```

- [ ] **Step 4.2: Typecheck:** `pnpm typecheck` → exit 0.

- [ ] **Step 4.3: Commit:**
```bash
git add "src/app/(app)/marketing/referrals/export/route.ts"
git commit -m "feat(marketing): reevo csv export for the call roster"
```

---

### Task 5: Referrals page UI (roster + ledger)

**Files:**
- Create: `src/app/(app)/marketing/referrals/page.tsx` (server component)
- Create: `src/app/(app)/marketing/referrals/roster-table.tsx` (client)
- Create: `src/app/(app)/marketing/referrals/ledger-table.tsx` (client)

Match the repo's existing UI idiom (Tailwind utility classes, status chips, simple tables). The page reads the active referral campaign by slug `referral-blitz-2026` falling back to most recent `type='referral'`.

- [ ] **Step 5.1: Create `page.tsx`:** server component that loads campaign, funnel counts (`count: "exact", head: true` queries per status/stage), first 200 roster rows (filter via `?status=` and `?q=` searchParams), all ledger rows (referrals are low-volume), and renders: header with Build Roster form button (`buildRoster`), Export CSV anchor (`/marketing/referrals/export?campaign=<id>`), funnel chips, `<RosterTable>`, `<LedgerTable>`, and an "Add referral" details/summary form posting `createReferral`. Pass plain serializable row arrays to the client components.

- [ ] **Step 5.2: Create `roster-table.tsx`:** client component. Each row: name, phone (tel: link), last job note, segment chip, attempts, status chip, and outcome buttons — No answer · Declined · **Referred** · DNC. Buttons call `logCallOutcome` via `useActionState`/form posts with hidden `outreach_id` + `call_status`. "Referred" expands an inline mini-form (referred name, phone, interest) posting `createReferral` with hidden `outreach_id`, `campaign_id`, `referrer_name`, `referrer_jobber_client_id`.

- [ ] **Step 5.3: Create `ledger-table.tsx`:** client component. Each row: referrer → referred (with phone), interest, stage `<select>` posting `updateReferralStage` on change, reward type select + status chip, "Mark sent" button (enabled when status due) posting `updateReward`, admin-only override (status select + required note) behind a disclosure, notes.

- [ ] **Step 5.4: Typecheck + lint:** `pnpm typecheck` → exit 0, `pnpm lint` → exit 0.

- [ ] **Step 5.5: Commit:**
```bash
git add "src/app/(app)/marketing/referrals/page.tsx" "src/app/(app)/marketing/referrals/roster-table.tsx" "src/app/(app)/marketing/referrals/ledger-table.tsx"
git commit -m "feat(marketing): referrals page — roster, call logging, ledger, rewards"
```

*(Exact JSX follows the repo's existing table/chip classes — written at execution time against current `globals.css` tokens; all interactive logic and action wiring as specified above.)*

---

### Task 6: Marketing overview page

**Files:**
- Create: `src/app/(app)/marketing/page.tsx`

- [ ] **Step 6.1: Create the overview:** server component with four stat tiles (Active campaigns / Calls remaining [queued] / Open referrals [stage not in completed_paid, lost] / **Rewards due**) computed via head-count queries, each linking into `/marketing/referrals`; below, a card list of campaigns (name, type, status, dates) and "coming in Phase 2/3" placeholders for Content and Campaign detail. Reuse the dashboard's tile styling idiom.

- [ ] **Step 6.2: Typecheck:** `pnpm typecheck` → exit 0.

- [ ] **Step 6.3: Commit:**
```bash
git add "src/app/(app)/marketing/page.tsx"
git commit -m "feat(marketing): overview page with live referral stats"
```

---

### Task 7: Nav flip + dashboard stats

**Files:**
- Modify: `src/components/app-switcher.tsx:100-108` (Marketing workspace entry)
- Modify: `src/lib/departments.ts:48` (`marketing: "/dashboard"` → `"/marketing"`)
- Modify: `src/app/(app)/dashboard/page.tsx:416-424` (marketing placeholder case)

- [ ] **Step 7.1: app-switcher.tsx** — replace the Marketing workspace entry with:

```ts
  {
    label: "Marketing",
    emoji: "📣",
    description: "Campaigns, referrals, content",
    primaryHref: "/marketing",
    tools: [
      { label: "Overview",  href: "/marketing" },
      { label: "Referrals", href: "/marketing/referrals" },
      { label: "Campaigns", href: "/marketing/campaigns", comingSoon: true },
      { label: "Content",   href: "/marketing/content",   comingSoon: true },
      { label: "Playbook",  href: "/marketing/playbook",  comingSoon: true },
    ],
    prefixes: ["/marketing"],
  },
```

- [ ] **Step 7.2: departments.ts** — `DEPARTMENT_HREF.marketing` → `"/marketing"`.

- [ ] **Step 7.3: dashboard/page.tsx** marketing case — replace placeholders with live counts:

```ts
    case "marketing": {
      const [activeCampaigns, queuedCalls, openReferrals, rewardsDue] = await Promise.all([
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("referral_outreach").select("id", { count: "exact", head: true }).eq("call_status", "queued"),
        supabase.from("referrals").select("id", { count: "exact", head: true }).not("stage", "in", "(completed_paid,lost)"),
        supabase.from("referrals").select("id", { count: "exact", head: true }).eq("reward_status", "due"),
      ]);
      return [
        { label: "Active campaigns", value: activeCampaigns.count ?? 0,
          tone: "neutral", href: "/marketing" },
        { label: "Calls remaining", value: queuedCalls.count ?? 0,
          tone: (queuedCalls.count ?? 0) > 0 ? "amber" : "neutral",
          href: "/marketing/referrals" },
        { label: "Open referrals", value: openReferrals.count ?? 0,
          tone: (openReferrals.count ?? 0) > 0 ? "blue" : "neutral",
          href: "/marketing/referrals" },
        { label: "Rewards due", value: rewardsDue.count ?? 0,
          tone: (rewardsDue.count ?? 0) > 0 ? "red" : "neutral",
          href: "/marketing/referrals" },
      ];
    }
```
(Adapt the tile fields to the exact local shape — the surrounding cases are the source of truth for `tone`/`href`/`hint` usage.)

- [ ] **Step 7.4: Typecheck + lint:** `pnpm typecheck` → exit 0, `pnpm lint` → exit 0.

- [ ] **Step 7.5: Commit:**
```bash
git add src/components/app-switcher.tsx src/lib/departments.ts "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(marketing): go live in nav + real dashboard stats"
```

---

### Task 8: Verify, ship, confirm deploy

- [ ] **Step 8.1: Full gates:** `pnpm typecheck` → exit 0; `pnpm lint` → exit 0; `pnpm build` → completes without error.
- [ ] **Step 8.2: Preview verification:** `preview_start` (`pnpm dev`), snapshot `/marketing` and `/marketing/referrals` (auth wall permitting — if the preview can't authenticate, record that and rely on build + deploy + post-deploy checks).
- [ ] **Step 8.3: Push (standing authorization):** `git push origin main`.
- [ ] **Step 8.4: Confirm Vercel deploy** via the Vercel MCP (`list_deployments` → newest deployment state READY for this commit SHA). Do not claim "deployed" from the push alone.
- [ ] **Step 8.5: Post-ship bookkeeping:** update vault `HOME.md` handoff + daily note (referral hub live; Phase 2 next), report to Stefan with funnel-usage instructions.

---

## Self-review (done at write time)

1. **Spec coverage (Phase 1 items):** migration/4 tables ✅ Task 1 · roster from jobber_clients ✅ Task 3 · outcome logging ✅ Task 3+5 · ledger + reward flips ✅ Task 3+5 · Reevo CSV ✅ Task 4 · campaign seed ✅ Task 1 · `/marketing` shell ✅ Task 6 · nav + dashboard stat ✅ Task 7 · gates/deploy ✅ Task 8. Spec §7.2 dashboard tiles "calls this week" simplified to "calls remaining" (count of queued) — equally actionable, no extra index needed; noted as intentional.
2. **Placeholder scan:** Task 5 JSX is specified by behavior + wiring rather than verbatim JSX (it must match live `globals.css` tokens; all logic, props, actions, and states are fully enumerated). No TBDs elsewhere.
3. **Type consistency:** enum literals in actions match migration enums (`no_answer`, `care_plan_1yr`, `completed_paid`, etc.); `ActionState` shape shared across all actions; helper names (`primaryPhone`, `primaryEmail`, `clientDisplayName`, `toCsv`) match their definitions.
