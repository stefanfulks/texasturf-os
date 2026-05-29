-- ============================================================
-- Inventory module settings (key/value, jsonb)
-- ============================================================

CREATE TABLE inv_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  value       jsonb,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_inv_settings_key ON inv_settings(key);

-- Touch updated_at on update
CREATE TRIGGER inv_settings_touch_updated_at
BEFORE UPDATE ON inv_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Seed the well-known keys with their defaults ────────────────
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

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE inv_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_settings: authenticated read" ON inv_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "inv_settings: admin/office manage" ON inv_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office'))
  );
