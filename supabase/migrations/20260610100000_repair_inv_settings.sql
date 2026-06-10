-- ============================================================
-- Recover the inv_settings table.
--
-- The original migration (20260529000000_init_inv_settings.sql) is recorded
-- as applied in schema_migrations but `inv_settings` does NOT exist in
-- remote — confirmed via `supabase inspect db table-stats --linked`. Likely
-- a partial apply (e.g. failed at the CREATE TRIGGER step) where the
-- migration record was force-inserted after the fact.
--
-- Consequence: `supabase gen types --linked` omits inv_settings, and app
-- code (src/lib/inventory/settings.ts) references it via the types but
-- runtime would fail on any query.
--
-- Fix: fully idempotent re-apply. Safe to run regardless of remote state.
-- ============================================================

CREATE TABLE IF NOT EXISTS inv_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  value       jsonb,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inv_settings_key ON inv_settings(key);

DROP TRIGGER IF EXISTS inv_settings_touch_updated_at ON inv_settings;
CREATE TRIGGER inv_settings_touch_updated_at
BEFORE UPDATE ON inv_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO inv_settings (key, value, description) VALUES
  ('default_receiving_location_id',
    'null'::jsonb,
    'UUID of the inv_locations row used as the default for the Receive flow.'),
  ('low_stock_threshold_factor',
    '1.5'::jsonb,
    'Multiplier applied to inv_items.min_quantity to define the warning threshold.'),
  ('auto_archive_completed_jobs_after_days',
    'null'::jsonb,
    'Auto-archive completed jobs after N days. null = never. Used by cron job.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE inv_settings ENABLE ROW LEVEL SECURITY;

-- Policies: idempotent via DROP IF EXISTS + CREATE.
DROP POLICY IF EXISTS "inv_settings: authenticated read" ON inv_settings;
CREATE POLICY "inv_settings: authenticated read" ON inv_settings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "inv_settings: admin/office manage" ON inv_settings;
CREATE POLICY "inv_settings: admin/office manage" ON inv_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office'))
  );

-- Explicit GRANTs (most public tables inherit these from Supabase defaults,
-- but being explicit guards against any drift that may have caused the
-- table to be invisible to PostgREST in the first place).
GRANT SELECT, INSERT, UPDATE, DELETE ON inv_settings TO authenticated;
GRANT ALL                              ON inv_settings TO service_role;
