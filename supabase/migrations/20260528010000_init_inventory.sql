-- ============================================================
-- Inventory Manager — Roll Inventory Port
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE roll_status AS ENUM (
  'available',
  'planned',
  'allocated',
  'staged',
  'dispatched',
  'consumed',
  'damaged',
  'returned'
);

CREATE TYPE roll_type AS ENUM (
  'parent',
  'child'
);

-- ── Locations ─────────────────────────────────────────────────

CREATE TABLE inv_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Products (turf types) ─────────────────────────────────────

CREATE TABLE inv_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  sku         text,
  width_ft    numeric(6,2),
  description text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Rolls ─────────────────────────────────────────────────────

CREATE TABLE inv_rolls (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tt_sku_tag_number      text UNIQUE,
  manufacturer_roll_number text,
  vendor_id              uuid REFERENCES vendors(id) ON DELETE SET NULL,
  product_id             uuid REFERENCES inv_products(id) ON DELETE SET NULL,
  product_name           text,
  dye_lot                text,
  width_ft               numeric(6,2),
  original_length_ft     numeric(8,2),
  current_length_ft      numeric(8,2),
  status                 roll_status NOT NULL DEFAULT 'available',
  roll_type              roll_type NOT NULL DEFAULT 'parent',
  parent_roll_id         uuid REFERENCES inv_rolls(id) ON DELETE SET NULL,
  location_id            uuid REFERENCES inv_locations(id) ON DELETE SET NULL,
  allocated_job_id       uuid,                          -- FK added after inv_jobs
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inv_rolls_status_idx    ON inv_rolls (status);
CREATE INDEX inv_rolls_vendor_idx    ON inv_rolls (vendor_id);

-- ── Jobs ──────────────────────────────────────────────────────

CREATE TABLE inv_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number       text,
  job_name         text NOT NULL,
  site_address     text,
  status           text NOT NULL DEFAULT 'Draft'
                     CHECK (status IN ('Draft','Ready','Active','Complete','Cancelled')),
  scheduled_date   date,
  completion_date  date,
  notes            text,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inv_jobs_status_idx ON inv_jobs (status);

-- Add FK from rolls → jobs now that inv_jobs exists
ALTER TABLE inv_rolls
  ADD CONSTRAINT inv_rolls_job_fkey
  FOREIGN KEY (allocated_job_id) REFERENCES inv_jobs(id) ON DELETE SET NULL;

-- ── Allocations ───────────────────────────────────────────────

CREATE TABLE inv_allocations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id               uuid NOT NULL REFERENCES inv_jobs(id) ON DELETE CASCADE,
  roll_id              uuid REFERENCES inv_rolls(id) ON DELETE SET NULL,
  product_id           uuid REFERENCES inv_products(id) ON DELETE SET NULL,
  product_name         text,
  width_ft             numeric(6,2),
  dye_lot_preference   text,
  requested_length_ft  numeric(8,2),
  status               text NOT NULL DEFAULT 'Planned'
                         CHECK (status IN ('Planned','Allocated','Staged','Dispatched','Consumed')),
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inv_allocations_job_idx ON inv_allocations (job_id);

-- ── Transactions (audit log) ──────────────────────────────────

CREATE TABLE inv_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL,
  roll_id          uuid REFERENCES inv_rolls(id) ON DELETE SET NULL,
  job_id           uuid REFERENCES inv_jobs(id) ON DELETE SET NULL,
  from_status      text,
  to_status        text,
  quantity_ft      numeric(8,2),
  notes            text,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── General Inventory Items (non-roll) ────────────────────────

CREATE TABLE inv_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  sku          text,
  quantity     numeric(10,2) NOT NULL DEFAULT 0,
  unit         text NOT NULL DEFAULT 'each',
  min_quantity numeric(10,2) NOT NULL DEFAULT 0,
  location_id  uuid REFERENCES inv_locations(id) ON DELETE SET NULL,
  notes        text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── updated_at triggers (reuse touch_updated_at from init_fleet) ──

CREATE TRIGGER inv_rolls_updated_at
  BEFORE UPDATE ON inv_rolls
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER inv_jobs_updated_at
  BEFORE UPDATE ON inv_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER inv_allocations_updated_at
  BEFORE UPDATE ON inv_allocations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER inv_items_updated_at
  BEFORE UPDATE ON inv_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE inv_locations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_rolls       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_items       ENABLE ROW LEVEL SECURITY;

-- Locations
CREATE POLICY "inv_locations: authenticated read" ON inv_locations
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inv_locations: admin/office manage" ON inv_locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office'))
  );

-- Products
CREATE POLICY "inv_products: authenticated read" ON inv_products
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inv_products: admin/office manage" ON inv_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office'))
  );

-- Rolls
CREATE POLICY "inv_rolls: authenticated read" ON inv_rolls
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inv_rolls: admin/office manage" ON inv_rolls
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office'))
  );

-- Jobs
CREATE POLICY "inv_jobs: authenticated read" ON inv_jobs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inv_jobs: admin/office manage" ON inv_jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office'))
  );

-- Allocations
CREATE POLICY "inv_allocations: authenticated read" ON inv_allocations
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inv_allocations: admin/office manage" ON inv_allocations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office'))
  );

-- Transactions (append-only audit log — authenticated can insert; admin/office can read all)
CREATE POLICY "inv_transactions: admin/office read" ON inv_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office'))
  );
CREATE POLICY "inv_transactions: authenticated insert" ON inv_transactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Inventory items
CREATE POLICY "inv_items: authenticated read" ON inv_items
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inv_items: admin/office manage" ON inv_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office'))
  );
