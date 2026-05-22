-- ============================================================
-- Invoice Submission & Approval System
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE invoice_status AS ENUM (
  'draft',
  'submitted',
  'ocr_processing',
  'ocr_review_needed',
  'awaiting_review',
  'awaiting_approval',
  'approved',
  'request_change',
  'rejected',
  'on_hold',
  'paid',
  'archived'
);

CREATE TYPE vendor_type AS ENUM (
  'installer',
  'contractor_1099',
  'subcontractor',
  'supplier',
  'other'
);

-- ── Vendors / Contractors ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  type            vendor_type NOT NULL DEFAULT 'contractor_1099',
  contact_name    text,
  email           text,
  phone           text,
  address         text,
  payment_terms   text,
  default_rates   jsonb,
  notes           text,
  active          boolean NOT NULL DEFAULT true,
  monday_item_id  text,
  created_by_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vendors_name_idx ON vendors (name);

-- ── Invoices ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   text NOT NULL,
  vendor_id               uuid REFERENCES vendors(id) ON DELETE SET NULL,
  submitted_by_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_by_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_by_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  status                  invoice_status NOT NULL DEFAULT 'submitted',

  -- Invoice metadata
  invoice_number          text,
  invoice_date            date,
  service_period_start    date,
  service_period_end      date,
  approval_deadline       date,

  -- Amounts
  subtotal                numeric(12,2),
  tax                     numeric(12,2),
  total_amount            numeric(12,2),
  currency                text NOT NULL DEFAULT 'USD',

  -- Project / job linkage
  project_id              uuid REFERENCES projects(id) ON DELETE SET NULL,
  job_name                text,
  customer_name           text,
  jobber_url              text,

  -- Original file
  original_file_url       text,
  original_file_type      text,   -- 'image/jpeg' | 'image/png' | 'application/pdf' etc.
  original_file_name      text,

  -- OCR
  ocr_text                text,
  ocr_confidence          numeric(5,2),   -- 0.00–100.00
  ocr_reviewed            boolean NOT NULL DEFAULT false,

  -- Notes
  admin_notes             text,
  variance_notes          text,
  ownership_notes         text,
  payment_notes           text,
  change_request_reason   text,

  -- Flags
  duplicate_warning       boolean NOT NULL DEFAULT false,
  archived                boolean NOT NULL DEFAULT false,

  -- Integrations
  monday_item_id          text,
  monday_board_id         text,
  slack_thread_ts         text,

  -- Payment
  paid_at                 timestamptz,
  payment_method          text,
  payment_reference       text,

  -- Timestamps
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  reviewed_at             timestamptz,
  approved_at             timestamptz,
  status_changed_at       timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoices_status_idx    ON invoices (status);
CREATE INDEX invoices_vendor_idx    ON invoices (vendor_id);
CREATE INDEX invoices_submitter_idx ON invoices (submitted_by_id);
CREATE INDEX invoices_project_idx   ON invoices (project_id);
CREATE INDEX invoices_created_idx   ON invoices (created_at DESC);

-- ── Invoice Line Items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description             text NOT NULL,
  normalized_description  text,
  category                text,   -- 'labor' | 'material' | 'delivery' | 'dump_fee' | 'equipment' | 'misc'
  quantity                numeric(10,3),
  unit                    text,
  unit_price              numeric(12,2),
  line_total              numeric(12,2) NOT NULL DEFAULT 0,
  expected_unit_price     numeric(12,2),
  variance_amount         numeric(12,2),
  variance_percent        numeric(8,2),
  variance_status         text NOT NULL DEFAULT 'not_reviewed',
    -- 'not_reviewed' | 'matches_expected' | 'overcharged' | 'undercharged' | 'unclear' | 'needs_review'
  variance_reason         text,
  sort_order              int NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── Invoice Status History ────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_status_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  previous_status     invoice_status,
  new_status          invoice_status NOT NULL,
  changed_by_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes               text,
  notification_sent   boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Invoice Comments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL,
  visibility  text NOT NULL DEFAULT 'internal',  -- 'internal' | 'external'
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Invoice Versions (re-submissions) ────────────────────────
CREATE TABLE IF NOT EXISTS invoice_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  version_number  int NOT NULL DEFAULT 1,
  file_url        text NOT NULL,
  file_name       text,
  submitted_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── OCR Jobs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ocr_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  provider        text NOT NULL DEFAULT 'mock',
  status          text NOT NULL DEFAULT 'pending',
    -- 'pending' | 'processing' | 'completed' | 'failed'
  raw_response    jsonb,
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Integration Sync Log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text NOT NULL,       -- 'slack' | 'monday' | 'email'
  local_entity_type   text NOT NULL,
  local_entity_id     uuid NOT NULL,
  external_entity_id  text,
  direction           text NOT NULL DEFAULT 'push',
  status              text NOT NULL,       -- 'success' | 'failed' | 'skipped'
  message             text,
  metadata            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- Vendors: all authenticated can read; admin/office can manage
CREATE POLICY "vendors: authenticated read" ON vendors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "vendors: admin/office manage" ON vendors FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office')));

-- Invoices: field users see only their own; office/admin see all
CREATE POLICY "invoices: own read (field)" ON invoices FOR SELECT
  USING (
    submitted_by_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office'))
  );
CREATE POLICY "invoices: insert authenticated" ON invoices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "invoices: update admin/office" ON invoices FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office')));
CREATE POLICY "invoices: update own draft" ON invoices FOR UPDATE
  USING (submitted_by_id = auth.uid() AND status = 'draft');

-- Line items follow invoice access
CREATE POLICY "invoice_line_items: read via invoice" ON invoice_line_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices i WHERE i.id = invoice_id
    AND (i.submitted_by_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office')))
  ));
CREATE POLICY "invoice_line_items: manage admin/office" ON invoice_line_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office')));

-- Status history
CREATE POLICY "invoice_status_history: read via invoice" ON invoice_status_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices i WHERE i.id = invoice_id
    AND (i.submitted_by_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office')))
  ));
CREATE POLICY "invoice_status_history: server insert" ON invoice_status_history FOR INSERT WITH CHECK (true);

-- Comments
CREATE POLICY "invoice_comments: read via invoice" ON invoice_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices i WHERE i.id = invoice_id
    AND (i.submitted_by_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office')))
  ));
CREATE POLICY "invoice_comments: insert authenticated" ON invoice_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "invoice_comments: update own" ON invoice_comments FOR UPDATE USING (user_id = auth.uid());

-- Versions
CREATE POLICY "invoice_versions: read via invoice" ON invoice_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices i WHERE i.id = invoice_id
    AND (i.submitted_by_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office')))
  ));
CREATE POLICY "invoice_versions: insert authenticated" ON invoice_versions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- OCR jobs: admin/office only
CREATE POLICY "ocr_jobs: admin/office read" ON ocr_jobs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office')));
CREATE POLICY "ocr_jobs: server insert" ON ocr_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "ocr_jobs: server update" ON ocr_jobs FOR UPDATE USING (true);

-- Sync logs: admin only
CREATE POLICY "integration_sync_logs: admin read" ON integration_sync_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "integration_sync_logs: server insert" ON integration_sync_logs FOR INSERT WITH CHECK (true);

-- ── Supabase Storage bucket (create via dashboard/CLI) ───────
-- Bucket name: invoices
-- Public: false  (use signed URLs)
-- Allowed MIME types: image/*, application/pdf
-- Max file size: 20MB
