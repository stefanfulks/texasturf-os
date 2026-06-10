-- TexasTurf OS — Marketing content engine (Phase 2)
-- Spec: docs/superpowers/specs/2026-06-10-marketing-section-design.md
-- Adds: voice_memo content type, asset_path (uploaded audio), the private
-- `marketing` storage bucket + policies, and seeds (spotlight campaigns +
-- content idea bank + Troy's 12-week calendar).
--
-- NOTE on apply order: `ALTER TYPE ... ADD VALUE` must commit before the value
-- is used. This file is applied in two passes by the operator/Management API:
--   pass 1: the ALTER TYPE statement (top, between the PASS-1 markers)
--   pass 2: everything below. No seed in pass 2 uses 'voice_memo', so the
--           split is only a belt-and-suspenders measure.

-- ── PASS 1 ───────────────────────────────────────────────────────────────────
alter type public.content_item_type add value if not exists 'voice_memo';
-- ── /PASS 1 ──────────────────────────────────────────────────────────────────

-- ── PASS 2 ───────────────────────────────────────────────────────────────────

alter table public.content_items
  add column if not exists asset_path text;  -- bucket-relative path for uploaded audio (voice memos)

-- Private bucket for small marketing audio (voice memos / VO takes). Video stays
-- in Drive/YouTube; only small audio (~1-5 MB) lives here. Path convention
-- (app-enforced): voice-memos/{uuid}-{filename}
insert into storage.buckets (id, name, public)
values ('marketing', 'marketing', false)
on conflict (id) do nothing;

-- storage.objects has RLS on by default; service role bypasses. Explicit policies
-- so the browser can upload + read directly. Read = any authenticated teammate
-- (so the whole team can press play). Write = admin or marketing department.
drop policy if exists "marketing read for authed" on storage.objects;
create policy "marketing read for authed"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'marketing');

drop policy if exists "marketing write for marketing" on storage.objects;
create policy "marketing write for marketing"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'marketing'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'marketing' = any(p.departments))
    )
  )
  with check (
    bucket_id = 'marketing'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'marketing' = any(p.departments))
    )
  );

-- ── Seed: service spotlight campaigns (Jul-Sep 2026) ─────────────────────────

insert into public.campaigns (slug, name, type, status, service_line, starts_on, brief_md)
values
  ('spotlight-pickleball-2026-07', 'July Spotlight — Pickleball & Sport Courts', 'service_spotlight', 'draft', 'courts', '2026-07-01',
   $md$**Angle:** "Beat the waitlist for fall leagues." Pickleball/basketball court installs.

**Kit:** Jobber email to past clients + sport-court interest → 1 Troy long video (court cost breakdown) → 4-6 short cuts → before/after set → SEO post → yard-sign/social CTA swap.$md$),
  ('spotlight-xeriscape-2026-08', 'August Spotlight — Xeriscape', 'service_spotlight', 'draft', 'xeriscape', '2026-08-01',
   $md$**Angle:** Water restrictions — "your lawn is dying anyway." Xeriscape conversions.

**Kit:** Jobber email + Troy "Xeriscape 101 for Central Texas" + shorts + before/after + SEO post.$md$),
  ('spotlight-fencing-welding-2026-09', 'September Spotlight — Fencing & Custom Welding', 'service_spotlight', 'draft', 'fencing', '2026-09-01',
   $md$**Angle:** Security, gates, steel that lasts. Fencing + custom welding.

**Kit:** Jobber email + Troy "Fence options compared: wood vs steel vs custom welded" + shorts + before/after + SEO post.$md$)
on conflict (slug) do nothing;

-- ── Seed: content idea bank + Troy 12-week calendar ──────────────────────────
-- All land at status 'idea'. Troy's calendar entries are long_video; POV are
-- pov_clip; spotlights are long_video tagged by service line.

insert into public.content_items (title, type, status, service_line, hook)
select v.title, v.type::public.content_item_type, 'idea'::public.content_item_status, v.service_line, v.hook
from (values
  -- Troy 12-week educational calendar (long_video)
  ('How Much Does Artificial Turf Cost in Texas? (honest 2026 breakdown)', 'long_video', 'turf', 'Troy wk1 — SEO pillar 1'),
  ('Best Artificial Turf for Dogs — what we actually install', 'long_video', 'turf', 'Troy wk2 — SEO pillar 2'),
  ('Does Turf Melt in Texas Heat? We test it at 105F', 'long_video', 'turf', 'Troy wk3 — SEO pillar 3'),
  ('Pickleball Court Cost: the full budget breakdown', 'long_video', 'courts', 'Troy wk4 — July spotlight'),
  ('Xeriscape 101 for Central Texas — kill your water bill', 'long_video', 'xeriscape', 'Troy wk5 — Aug spotlight'),
  ('Pavers vs Stamped Concrete — an honest comparison', 'long_video', 'pavers', 'Troy wk6 — Oct spotlight'),
  ('What "Site Prep" Actually Means (and why cheap quotes skip it)', 'long_video', 'site_prep', 'Troy wk7 — trust builder'),
  ('Lot Clearing: what it costs and what to expect', 'long_video', 'lot_clearing', 'Troy wk8 — service intro'),
  ('5 Mistakes People Make Buying Turf (from hundreds of installs)', 'long_video', 'turf', 'Troy wk9 — evergreen'),
  ('Putting Green Install — start to finish', 'long_video', 'turf', 'Troy wk10 — service intro'),
  ('Fence Options Compared: wood vs steel vs custom welded', 'long_video', 'fencing', 'Troy wk11 — Sep spotlight'),
  ('Designing a Full Backyard — a real project, sketch to done', 'long_video', 'landscape_design', 'Troy wk12 — design showcase'),
  -- POV / day-in-the-life (Max, Meta glasses)
  ('Excavator first-person full dig', 'pov_clip', 'excavation', 'Max POV'),
  ('Skid-steer loading timelapse', 'pov_clip', 'excavation', 'Max POV'),
  ('One yard in one day (full install timelapse)', 'pov_clip', 'turf', 'Max POV'),
  ('Seam-gluing closeup (satisfying)', 'pov_clip', 'turf', 'Max POV'),
  ('Turf roll carry and unroll', 'pov_clip', 'turf', 'Max POV'),
  ('Plate compactor ASMR', 'pov_clip', 'site_prep', 'Max POV'),
  ('Court striping POV', 'pov_clip', 'courts', 'Max POV'),
  ('Demo day', 'pov_clip', 'lot_clearing', 'Max POV'),
  ('6am truck loadout', 'pov_clip', null, 'Max POV'),
  ('Finished-yard reveal walkthrough', 'pov_clip', 'turf', 'Max POV'),
  ('Rain-day welding shop POV', 'pov_clip', 'welding', 'Max POV'),
  -- Educational extras (Troy / talking head)
  ('Drainage explained — where the water actually goes', 'long_video', 'turf', 'educational'),
  ('Pet odor: what actually works', 'long_video', 'turf', 'educational'),
  ('Infill myths (we install zero-infill)', 'long_video', 'turf', 'educational'),
  ('HOA turf approval guide by city', 'long_video', 'turf', 'educational'),
  ('DIY vs pro install — where DIY goes wrong', 'long_video', 'turf', 'educational'),
  ('Why Netherlands-sourced turf matters', 'long_video', 'turf', 'educational'),
  ('Grading and drainage 101', 'long_video', 'site_prep', 'educational'),
  ('What we found under this lawn', 'long_video', 'lot_clearing', 'educational'),
  -- Service spotlight flagship videos (one per line)
  ('Xeriscape: full transformation story', 'long_video', 'xeriscape', 'spotlight flagship'),
  ('Lot clearing: before and after', 'long_video', 'lot_clearing', 'spotlight flagship'),
  ('Paver patio: design to install', 'long_video', 'pavers', 'spotlight flagship'),
  ('Tree removal: safe takedown', 'long_video', 'tree_removal', 'spotlight flagship'),
  ('Excavation and site prep: the foundation', 'long_video', 'excavation', 'spotlight flagship'),
  ('Stone work: walls and borders', 'long_video', 'stone_work', 'spotlight flagship'),
  ('Concrete: driveways and slabs', 'long_video', 'concrete', 'spotlight flagship'),
  ('Pickleball court: full build', 'long_video', 'courts', 'spotlight flagship'),
  ('Custom welding: gates and steel', 'long_video', 'welding', 'spotlight flagship'),
  ('Landscape design: the full process', 'long_video', 'landscape_design', 'spotlight flagship'),
  -- Field proof formats (crew)
  ('Before walkthrough template (30s narrated)', 'before_after', null, 'crew field proof'),
  ('Mid-job process clip template', 'short', null, 'crew field proof'),
  ('After reveal template (homeowner reaction)', 'before_after', null, 'crew field proof'),
  ('10-shot before/after photo set template', 'photo_set', null, 'crew field proof'),
  -- Seasonal / local / community
  ('Austin water-restriction news-jack', 'short', 'xeriscape', 'seasonal'),
  ('Freeze-damage cleanup (January)', 'short', 'lot_clearing', 'seasonal'),
  ('Bluebonnet-season xeriscape', 'short', 'xeriscape', 'seasonal'),
  ('Summer "backyard ready" series', 'short', 'turf', 'seasonal'),
  ('Holiday-hosting patio push', 'short', 'pavers', 'seasonal'),
  ('Sponsor a local pickleball tournament', 'short', 'courts', 'community/PR'),
  ('Crew spotlight series', 'short', null, 'community/PR'),
  ('Client story testimonials', 'short', null, 'community/PR'),
  ('"Ask a Turf Guy" Q&A shorts', 'short', 'turf', 'community/PR')
) as v(title, type, service_line, hook)
where not exists (
  select 1 from public.content_items c where c.title = v.title
);

-- ── /PASS 2 ──────────────────────────────────────────────────────────────────

-- CLI bookkeeping (applied via Management API; record so a future db push skips it)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text
);
insert into supabase_migrations.schema_migrations (version, name)
values ('20260610210000', 'marketing_content')
on conflict (version) do nothing;
