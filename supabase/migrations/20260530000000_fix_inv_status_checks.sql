-- ============================================================
-- Fix inv_jobs / inv_allocations status CHECK constraints.
--
-- The initial inventory migration defined capitalized status enums
-- (`'Draft','Ready','Active','Complete','Cancelled'` for jobs and
--  `'Planned','Allocated','Staged','Dispatched','Consumed'` for allocations),
-- but every app-side server action writes lowercase values that match the
-- workflow the UI actually expresses (`planning / in_progress / staged /
-- completed / archived`). As a result, every job mutation and every
-- allocation mutation from the UI fails with a CHECK constraint violation
-- in production.
--
-- This migration:
--   1. Drops the old CHECK constraints
--   2. Migrates existing rows (seeded from Base44) to the app-canonical values
--   3. Adds new CHECK constraints matching the app's actual usage
-- ============================================================

-- ── inv_jobs ─────────────────────────────────────────────────

ALTER TABLE inv_jobs DROP CONSTRAINT IF EXISTS inv_jobs_status_check;

-- Map any imported / legacy values into the canonical app values.
UPDATE inv_jobs SET status = CASE status
  WHEN 'Draft'     THEN 'planning'
  WHEN 'Ready'     THEN 'planning'
  WHEN 'Active'    THEN 'in_progress'
  WHEN 'Complete'  THEN 'completed'
  WHEN 'Cancelled' THEN 'archived'
  ELSE status
END
WHERE status IN ('Draft','Ready','Active','Complete','Cancelled');

-- Also handle the default ('Draft' set by the old DEFAULT clause).
ALTER TABLE inv_jobs ALTER COLUMN status SET DEFAULT 'planning';

ALTER TABLE inv_jobs
  ADD CONSTRAINT inv_jobs_status_check
  CHECK (status IN ('planning','in_progress','staged','completed','archived'));

-- ── inv_allocations ─────────────────────────────────────────

ALTER TABLE inv_allocations DROP CONSTRAINT IF EXISTS inv_allocations_status_check;

-- Map imported values. Dispatched (physically left warehouse) maps to
-- 'completed' since the allocation's workflow has ended. Consumed is also
-- terminal → 'completed'. Planned → 'requested' (pre-allocation intake state).
UPDATE inv_allocations SET status = CASE status
  WHEN 'Planned'    THEN 'requested'
  WHEN 'Allocated'  THEN 'allocated'
  WHEN 'Staged'     THEN 'staged'
  WHEN 'Dispatched' THEN 'completed'
  WHEN 'Consumed'   THEN 'completed'
  ELSE status
END
WHERE status IN ('Planned','Allocated','Staged','Dispatched','Consumed');

ALTER TABLE inv_allocations ALTER COLUMN status SET DEFAULT 'requested';

ALTER TABLE inv_allocations
  ADD CONSTRAINT inv_allocations_status_check
  CHECK (status IN ('requested','allocated','staged','completed','cancelled'));

-- ── inv_transactions RLS hardening ───────────────────────────
-- The original policy let any authenticated user INSERT (including field role)
-- with a forged `created_by` value, but only admin/office could SELECT. That's
-- a "write-only-forge-able audit log" gap.
--
-- Tighten: only admin/office can write, and the insert must use auth.uid()
-- as `created_by` (no forgery).

DROP POLICY IF EXISTS "inv_transactions: authenticated insert" ON inv_transactions;
DROP POLICY IF EXISTS "inv_transactions: admin/office insert with own uid" ON inv_transactions;

CREATE POLICY "inv_transactions: admin/office insert with own uid" ON inv_transactions
  FOR INSERT
  WITH CHECK (
    (created_by IS NULL OR created_by = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office')
    )
  );
