-- TexasTurf OS — Seed: Fleet assets from Monday board "Fleet & Equipment Tracking"
-- Source board: 18407602898  (texasturfusa-bunch.monday.com)
-- Pulled: 2026-05-20.
--
-- Run AFTER 20260513120000_init_fleet.sql.
-- Idempotent: ON CONFLICT (monday_item_id) skips rows that already exist,
-- so re-running this file is safe.

set search_path = public;

-- ─────────────────────────────────────────────────────────────────────
-- Insert all 28 assets. attached_to_id is set in a second pass after
-- all rows exist so we can resolve the self-references by monday_item_id.
-- ─────────────────────────────────────────────────────────────────────

insert into public.assets
  (monday_item_id, name, unit_type, status, ready_status, load_status, primary_unit)
values
  -- Trucks (8)
  ('11693155845', 'Ram 1500 #2',            'truck',           'available',    'ready', 'empty', false),
  ('11693175625', 'Ram 1500 #1',            'truck',           'in_use_today', 'ready', 'empty', false),
  ('11693175162', 'Ram 2500 #2',            'truck',           'available',    'ready', 'empty', false),
  ('11693191059', 'Ram 3500 #1',            'truck',           'available',    'ready', 'empty', false),
  ('11693155976', 'Ford E450 #1',           'truck',           'available',    'ready', 'empty', false),
  ('11693175944', 'Ford E450 #2',           'truck',           'available',    'ready', 'empty', false),
  ('11693170137', 'Ford E-Series Van',      'truck',           'available',    'ready', 'empty', false),
  ('11693156004', 'International DuraStar', 'truck',           'available',    'ready', 'empty', false),

  -- Trailers (9)
  ('11693175333', 'Dump Trailer #2',        'trailer',         'available',    'ready', 'empty', false),
  ('11693175874', 'Gooseneck Dump Trailer', 'trailer',         'available',    'ready', 'empty', false),
  ('11693170235', 'Flatbed Trailer',        'trailer',         'available',    'ready', 'empty', false),
  ('11693174969', 'Top Hat Trailer 7x14',   'trailer',         'available',    'ready', 'empty', false),
  ('11693175568', 'Mini Dump Trailer',      'trailer',         'available',    'ready', 'empty', false),
  ('11693156019', 'Rollster Dump Box #1',   'trailer',         'available',    'ready', 'empty', false),
  ('11693155751', 'Rollster Dump Box #2',   'trailer',         'available',    'ready', 'empty', false),
  ('11693155573', 'Rollster Dump Box #3',   'trailer',         'available',    'ready', 'empty', false),
  ('11693176134', 'Rollster Dump Box #4',   'trailer',         'available',    'ready', 'empty', false),

  -- Heavy Equipment (11)
  ('11693169682', 'Kubota Skid Steer #1',   'heavy_equipment', 'available',    'ready', 'empty', false),
  ('11693169881', 'Kubota Skid Steer #2',   'heavy_equipment', 'available',    'ready', 'empty', false),
  ('11693155844', 'Mini Excavator',         'heavy_equipment', 'available',    'ready', 'empty', false),
  ('11693175873', 'Vermeer Mini Skid Steer','heavy_equipment', 'available',    'ready', 'empty', false),
  ('11693156289', 'Kubota RTV 900',         'heavy_equipment', 'available',    'ready', 'empty', false),
  ('11693156002', 'Rascal Pro ATV',         'heavy_equipment', 'available',    'ready', 'empty', false),
  ('11693155478', 'Roller Compactor',       'heavy_equipment', 'available',    'ready', 'empty', false),
  ('11693169066', 'Kubota Track Loader',    'heavy_equipment', 'available',    'ready', 'empty', false),
  ('11693155559', 'Plate Compactor',        'heavy_equipment', 'available',    'ready', 'empty', false),
  ('11693174742', 'Forklift Hyster',        'heavy_equipment', 'available',    'ready', 'empty', false),
  ('11693175332', 'Forklift Toyota',        'heavy_equipment', 'available',    'ready', 'empty', false)

on conflict (monday_item_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- Rig chain attachments (3 links from Monday's "Attached To" column).
-- ─────────────────────────────────────────────────────────────────────

with attachments(child_monday_id, parent_monday_id) as (
  values
    ('11693155845'::text, '11693175333'::text),  -- Ram 1500 #2          -> Dump Trailer #2
    ('11693156019',       '11693175333'),        -- Rollster Dump Box #1 -> Dump Trailer #2
    ('11693175625',       '11693156019')         -- Ram 1500 #1          -> Rollster Dump Box #1
)
update public.assets a
   set attached_to_id = parent.id
  from attachments att
  join public.assets parent on parent.monday_item_id = att.parent_monday_id
 where a.monday_item_id = att.child_monday_id;

-- ─────────────────────────────────────────────────────────────────────
-- Sanity checks — run these in the SQL Editor after the inserts to verify.
-- ─────────────────────────────────────────────────────────────────────

-- select count(*) from public.assets;
--   expected: 28
-- select count(*) from public.assets where attached_to_id is not null;
--   expected: 3
-- select unit_type, count(*) from public.assets group by unit_type order by unit_type;
--   expected: heavy_equipment=11, trailer=9, truck=8
