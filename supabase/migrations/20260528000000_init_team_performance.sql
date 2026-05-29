-- ============================================================
-- Team Performance Tracking
-- ============================================================

-- ── team_members ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   text NOT NULL,
  role_title  text NOT NULL,
  department  text,
  profile_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_members_active_idx ON team_members (active);

-- ── team_kpi_definitions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_kpi_definitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id  uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  kpi_key         text NOT NULL,
  kpi_label       text NOT NULL,
  target_value    numeric(12,4) NOT NULL,
  unit            text,
  lower_is_better boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (team_member_id, kpi_key)
);

CREATE INDEX IF NOT EXISTS team_kpi_definitions_member_idx ON team_kpi_definitions (team_member_id);

-- ── team_kpi_entries ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_kpi_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id  uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  kpi_key         text NOT NULL,
  period_month    smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year     smallint NOT NULL CHECK (period_year >= 2020),
  actual_value    numeric(12,4),
  notes           text,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (team_member_id, kpi_key, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS team_kpi_entries_member_period_idx ON team_kpi_entries (team_member_id, period_year, period_month);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_kpi_entries ENABLE ROW LEVEL SECURITY;

-- team_members policies
DROP POLICY IF EXISTS "team_members: authenticated read" ON team_members;
CREATE POLICY "team_members: authenticated read" ON team_members
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "team_members: admin insert" ON team_members;
CREATE POLICY "team_members: admin insert" ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (public.current_role() = 'admin');

DROP POLICY IF EXISTS "team_members: admin update" ON team_members;
CREATE POLICY "team_members: admin update" ON team_members
  FOR UPDATE TO authenticated
  USING (public.current_role() = 'admin');

DROP POLICY IF EXISTS "team_members: admin delete" ON team_members;
CREATE POLICY "team_members: admin delete" ON team_members
  FOR DELETE TO authenticated
  USING (public.current_role() = 'admin');

-- team_kpi_definitions policies
DROP POLICY IF EXISTS "team_kpi_definitions: authenticated read" ON team_kpi_definitions;
CREATE POLICY "team_kpi_definitions: authenticated read" ON team_kpi_definitions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "team_kpi_definitions: admin insert" ON team_kpi_definitions;
CREATE POLICY "team_kpi_definitions: admin insert" ON team_kpi_definitions
  FOR INSERT TO authenticated
  WITH CHECK (public.current_role() = 'admin');

DROP POLICY IF EXISTS "team_kpi_definitions: admin update" ON team_kpi_definitions;
CREATE POLICY "team_kpi_definitions: admin update" ON team_kpi_definitions
  FOR UPDATE TO authenticated
  USING (public.current_role() = 'admin');

DROP POLICY IF EXISTS "team_kpi_definitions: admin delete" ON team_kpi_definitions;
CREATE POLICY "team_kpi_definitions: admin delete" ON team_kpi_definitions
  FOR DELETE TO authenticated
  USING (public.current_role() = 'admin');

-- team_kpi_entries policies
DROP POLICY IF EXISTS "team_kpi_entries: authenticated read" ON team_kpi_entries;
CREATE POLICY "team_kpi_entries: authenticated read" ON team_kpi_entries
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "team_kpi_entries: admin/office insert" ON team_kpi_entries;
CREATE POLICY "team_kpi_entries: admin/office insert" ON team_kpi_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.current_role() IN ('admin', 'office'));

DROP POLICY IF EXISTS "team_kpi_entries: admin/office update" ON team_kpi_entries;
CREATE POLICY "team_kpi_entries: admin/office update" ON team_kpi_entries
  FOR UPDATE TO authenticated
  USING (public.current_role() IN ('admin', 'office'));

DROP POLICY IF EXISTS "team_kpi_entries: admin/office delete" ON team_kpi_entries;
CREATE POLICY "team_kpi_entries: admin/office delete" ON team_kpi_entries
  FOR DELETE TO authenticated
  USING (public.current_role() IN ('admin', 'office'));

-- ── updated_at triggers ──────────────────────────────────────
-- Reuses touch_updated_at from init_fleet migration

DROP TRIGGER IF EXISTS touch_team_members ON public.team_members;
CREATE TRIGGER touch_team_members
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_team_kpi_entries ON public.team_kpi_entries;
CREATE TRIGGER touch_team_kpi_entries
  BEFORE UPDATE ON public.team_kpi_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Seed data ─────────────────────────────────────────────────

-- team_members
INSERT INTO team_members (id, full_name, role_title, department) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Ivana Fulks',    'Director of Operations',        'Operations'),
  ('11111111-0000-0000-0000-000000000002', 'Maximilian Fulks','Field Manager',                 'Field'),
  ('11111111-0000-0000-0000-000000000003', 'Nate O''Connor',  'Warehouse Manager',             'Warehouse'),
  ('11111111-0000-0000-0000-000000000004', 'Maddie Baird',   'Office & Operations Administrator','Office'),
  ('11111111-0000-0000-0000-000000000005', 'Allison Pasch',  'Commercial Sales Consultant',   'Sales'),
  ('11111111-0000-0000-0000-000000000006', 'Colin Corcoran', 'Residential Sales Consultant',  'Sales')
ON CONFLICT (id) DO NOTHING;

-- team_kpi_definitions — Ivana Fulks (Director of Operations)
INSERT INTO team_kpi_definitions (team_member_id, kpi_key, kpi_label, target_value, unit, lower_is_better) VALUES
  ('11111111-0000-0000-0000-000000000001', 'capacity_utilization_rate',    'Capacity Utilization Rate',      85,   '%',    false),
  ('11111111-0000-0000-0000-000000000001', 'schedule_adherence',           'Schedule Adherence',             90,   '%',    false),
  ('11111111-0000-0000-0000-000000000001', 'customer_satisfaction_score',  'Customer Satisfaction Score',    4.5,  '/5.0', false),
  ('11111111-0000-0000-0000-000000000001', 'customer_complaint_rate',      'Customer Complaint Rate',        5,    '%',    true),
  ('11111111-0000-0000-0000-000000000001', 'ar_aging_over_30_days',        'AR Aging Over 30 Days',          10,   '%',    true),
  ('11111111-0000-0000-0000-000000000001', 'ap_processing_accuracy',       'AP Processing Accuracy',         100,  '%',    false),
  ('11111111-0000-0000-0000-000000000001', 'commission_processing_accuracy','Commission Processing Accuracy', 100, '%',    false),
  ('11111111-0000-0000-0000-000000000001', 'data_entry_accuracy',          'Data Entry Accuracy',            99,   '%',    false),
  ('11111111-0000-0000-0000-000000000001', 'team_review_completion',       'Team Review Completion',         100,  '%',    false),
  ('11111111-0000-0000-0000-000000000001', 'monthly_reporting_on_time',    'Monthly Reporting On Time',      100,  '%',    false)
ON CONFLICT (team_member_id, kpi_key) DO NOTHING;

-- team_kpi_definitions — Maximilian Fulks (Field Manager)
INSERT INTO team_kpi_definitions (team_member_id, kpi_key, kpi_label, target_value, unit, lower_is_better) VALUES
  ('11111111-0000-0000-0000-000000000002', 'customer_quality_rating',          'Customer Quality Rating',         4.5, '/5.0',  false),
  ('11111111-0000-0000-0000-000000000002', 'contractor_quality_rating',        'Contractor Quality Rating',       4.0, '/5.0',  false),
  ('11111111-0000-0000-0000-000000000002', 'rework_rate',                      'Rework Rate',                     5,   '%',     true),
  ('11111111-0000-0000-0000-000000000002', 'warranty_claim_rate',              'Warranty Claim Rate',             3,   '%',     true),
  ('11111111-0000-0000-0000-000000000002', 'installation_on_schedule',         'Installation On Schedule',        90,  '%',     false),
  ('11111111-0000-0000-0000-000000000002', 'installation_duration_accuracy',   'Installation Duration Accuracy',  80,  '%',     false),
  ('11111111-0000-0000-0000-000000000002', 'pre_installation_inspection',      'Pre-Installation Inspection',     100, '%',     false),
  ('11111111-0000-0000-0000-000000000002', 'final_walkthrough_completion',     'Final Walkthrough Completion',    100, '%',     false),
  ('11111111-0000-0000-0000-000000000002', 'customer_satisfaction_at_completion','Customer Satisfaction at Completion', 4.5, '/5.0', false),
  ('11111111-0000-0000-0000-000000000002', 'safety_incidents',                 'Safety Incidents',                0,   'count', true),
  ('11111111-0000-0000-0000-000000000002', 'on_time_contractor_arrival',       'On-Time Contractor Arrival',      95,  '%',     false)
ON CONFLICT (team_member_id, kpi_key) DO NOTHING;

-- team_kpi_definitions — Nate O'Connor (Warehouse Manager)
INSERT INTO team_kpi_definitions (team_member_id, kpi_key, kpi_label, target_value, unit, lower_is_better) VALUES
  ('11111111-0000-0000-0000-000000000003', 'material_readiness',           'Material Readiness',          100, '%',           false),
  ('11111111-0000-0000-0000-000000000003', 'inventory_accuracy',           'Inventory Accuracy',          95,  '%',           false),
  ('11111111-0000-0000-0000-000000000003', 'stockout_incidents',           'Stockout Incidents',          2,   'count/quarter',true),
  ('11111111-0000-0000-0000-000000000003', 'material_delivery_on_schedule','Material Delivery On Schedule',95, '%',           false),
  ('11111111-0000-0000-0000-000000000003', 'equipment_downtime',           'Equipment Downtime',          2,   '%',           true),
  ('11111111-0000-0000-0000-000000000003', 'warehouse_safety_incidents',   'Warehouse Safety Incidents',  0,   'count',       true),
  ('11111111-0000-0000-0000-000000000003', 'order_fulfillment_accuracy',   'Order Fulfillment Accuracy',  98,  '%',           false),
  ('11111111-0000-0000-0000-000000000003', 'tool_checkout_compliance',     'Tool Checkout Compliance',    95,  '%',           false)
ON CONFLICT (team_member_id, kpi_key) DO NOTHING;

-- team_kpi_definitions — Maddie Baird (Office & Operations Administrator)
INSERT INTO team_kpi_definitions (team_member_id, kpi_key, kpi_label, target_value, unit, lower_is_better) VALUES
  ('11111111-0000-0000-0000-000000000004', 'estimate_scheduling',                'Estimate Scheduling',                 95,  '%',    false),
  ('11111111-0000-0000-0000-000000000004', 'customer_response_time',             'Customer Response Time',              4,   'hrs',  true),
  ('11111111-0000-0000-0000-000000000004', 'data_entry_accuracy',                'Data Entry Accuracy',                 98,  '%',    false),
  ('11111111-0000-0000-0000-000000000004', 'report_delivery_on_time',            'Report Delivery On Time',             100, '%',    false),
  ('11111111-0000-0000-0000-000000000004', 'customer_communication_satisfaction','Customer Communication Satisfaction', 4.0, '/5.0', false),
  ('11111111-0000-0000-0000-000000000004', 'task_completion_rate',               'Task Completion Rate',                95,  '%',    false),
  ('11111111-0000-0000-0000-000000000004', 'administrative_error_rate',          'Administrative Error Rate',           2,   '%',    true)
ON CONFLICT (team_member_id, kpi_key) DO NOTHING;

-- team_kpi_definitions — Allison Pasch (Commercial Sales Consultant)
INSERT INTO team_kpi_definitions (team_member_id, kpi_key, kpi_label, target_value, unit, lower_is_better) VALUES
  ('11111111-0000-0000-0000-000000000005', 'annual_revenue',            'Annual Revenue',            1500000, '$',              false),
  ('11111111-0000-0000-0000-000000000005', 'win_rate',                  'Win Rate',                  30,      '%',              false),
  ('11111111-0000-0000-0000-000000000005', 'gross_margin',              'Gross Margin',              50,      '%',              false),
  ('11111111-0000-0000-0000-000000000005', 'crm_data_accuracy',         'CRM Data Accuracy',         100,     '%',              false),
  ('11111111-0000-0000-0000-000000000005', 'speed_to_lead',             'Speed to Lead',             1,       'days',           true),
  ('11111111-0000-0000-0000-000000000005', 'new_opportunities_per_month','New Opportunities/Month',  6,       'count',          false),
  ('11111111-0000-0000-0000-000000000005', 'dealer_network_growth',     'Dealer Network Growth',     2,       'partners/quarter',false)
ON CONFLICT (team_member_id, kpi_key) DO NOTHING;

-- team_kpi_definitions — Colin Corcoran (Residential Sales Consultant)
INSERT INTO team_kpi_definitions (team_member_id, kpi_key, kpi_label, target_value, unit, lower_is_better) VALUES
  ('11111111-0000-0000-0000-000000000006', 'annual_revenue',        'Annual Revenue',        1500000, '$',    false),
  ('11111111-0000-0000-0000-000000000006', 'quote_to_close_rate',   'Quote-to-Close Rate',   40,      '%',    false),
  ('11111111-0000-0000-0000-000000000006', 'average_days_to_close', 'Avg Days to Close',     14,      'days', true),
  ('11111111-0000-0000-0000-000000000006', 'gross_margin',          'Gross Margin',          50,      '%',    false),
  ('11111111-0000-0000-0000-000000000006', 'lead_generation',       'Lead Generation',       7,       'per week',false),
  ('11111111-0000-0000-0000-000000000006', 'site_visits_per_week',  'Site Visits/Week',      10,      'count',false),
  ('11111111-0000-0000-0000-000000000006', 'crm_data_accuracy',     'CRM Data Accuracy',     100,     '%',    false),
  ('11111111-0000-0000-0000-000000000006', 'customer_satisfaction', 'Customer Satisfaction', 4.5,     '/5.0', false),
  ('11111111-0000-0000-0000-000000000006', 'review_generation',     'Review Generation',     4,       'per month',false)
ON CONFLICT (team_member_id, kpi_key) DO NOTHING;
