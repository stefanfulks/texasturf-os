-- ============================================================
-- Reports & KPI Dashboard
-- ============================================================

-- ── Budgets ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month     smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year      smallint NOT NULL CHECK (period_year >= 2020),
  category         text NOT NULL,
    -- 'subcontractors' | 'materials' | 'labor' | 'overhead' | 'equipment' | 'other'
  budgeted_amount  numeric(12,2) NOT NULL DEFAULT 0,
  notes            text,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (period_month, period_year, category)
);

CREATE INDEX budgets_period_idx ON budgets (period_year, period_month);

-- ── KPI Entries ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kpi_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month   smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year    smallint NOT NULL CHECK (period_year >= 2020),
  kpi_key        text NOT NULL,
    -- e.g. 'capacity_utilization_pct', 'customer_satisfaction', 'quote_to_install_days'
  kpi_label      text NOT NULL,
  actual_value   numeric(12,4),
  target_value   numeric(12,4),
  unit           text,
    -- '%' | 'days' | 'score' | '$' | 'count'
  notes          text,
  created_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE (kpi_key, period_month, period_year)
);

CREATE INDEX kpi_entries_period_idx ON kpi_entries (period_year, period_month);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_entries ENABLE ROW LEVEL SECURITY;

-- Budgets: all authenticated users can read
CREATE POLICY "budgets: authenticated read" ON budgets
  FOR SELECT USING (auth.role() = 'authenticated');

-- Budgets: only admin/office can insert/update/delete
CREATE POLICY "budgets: admin/office insert" ON budgets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office'))
  );
CREATE POLICY "budgets: admin/office update" ON budgets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office'))
  );
CREATE POLICY "budgets: admin/office delete" ON budgets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office'))
  );

-- KPI entries: all authenticated users can read
CREATE POLICY "kpi_entries: authenticated read" ON kpi_entries
  FOR SELECT USING (auth.role() = 'authenticated');

-- KPI entries: only admin/office can insert/update/delete
CREATE POLICY "kpi_entries: admin/office insert" ON kpi_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office'))
  );
CREATE POLICY "kpi_entries: admin/office update" ON kpi_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office'))
  );
CREATE POLICY "kpi_entries: admin/office delete" ON kpi_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office'))
  );

-- ── updated_at triggers ──────────────────────────────────────
-- Reuses touch_updated_at from init_fleet migration

DROP TRIGGER IF EXISTS touch_budgets ON public.budgets;
CREATE TRIGGER touch_budgets
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_kpi_entries ON public.kpi_entries;
CREATE TRIGGER touch_kpi_entries
  BEFORE UPDATE ON public.kpi_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
