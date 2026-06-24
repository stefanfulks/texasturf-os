-- ============================================================
-- Vendor Purchasing & Order Tracking
-- One row per purchase request → vendor order → payment.
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE po_status AS ENUM (
  'new_request',
  'awaiting_review',
  'awaiting_approval',
  'quote_gathering',
  'ready_to_order',
  'order_placed',
  'waiting_on_vendor',
  'in_transit',
  'delivered',
  'payment_outstanding',
  'closed',
  'cancelled'
);

CREATE TYPE po_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TYPE po_purchase_type AS ENUM ('inventory_replenishment', 'project_specific');

CREATE TYPE po_payment_terms AS ENUM (
  'paid_in_full',
  'deposit',
  'net_15',
  'net_30',
  'net_45',
  'due_on_delivery',
  'other'
);

CREATE TYPE po_payment_status AS ENUM ('not_due', 'due_soon', 'past_due', 'paid');

-- ── Purchase orders ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq                     integer GENERATED ALWAYS AS IDENTITY,  -- display: PO-{seq}

  status                  po_status NOT NULL DEFAULT 'new_request',

  -- Request
  assigned_buyer_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by            text,                                   -- free text (requester may not be an app user)
  requested_by_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_date            date NOT NULL DEFAULT current_date,
  priority                po_priority NOT NULL DEFAULT 'normal',
  needed_by               date,
  purchase_type           po_purchase_type NOT NULL DEFAULT 'inventory_replenishment',
  project_id              uuid REFERENCES projects(id) ON DELETE SET NULL,
  job_name                text,
  request_description     text NOT NULL,
  material_needed         text,
  quantity_needed         text,                                   -- free text, e.g. "3 pallets"
  notes                   text,

  -- Vendor
  vendor_id               uuid REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_contact          text,
  quote_amount            numeric(12,2),
  estimated_cost          numeric(12,2),
  final_order_amount      numeric(12,2),
  po_number               text,
  order_date              date,

  -- Shipping
  carrier                 text,
  tracking_number         text,
  tracking_url            text,
  eta                     date,
  expected_delivery_date  date,
  actual_delivery_date    date,

  -- Receiving
  received_by             text,
  quantity_received       text,
  shortages_reported      boolean NOT NULL DEFAULT false,
  shortage_notes          text,
  damage_reported         boolean NOT NULL DEFAULT false,
  damage_notes            text,

  -- Payment
  payment_terms           po_payment_terms,
  deposit_required        boolean NOT NULL DEFAULT false,
  deposit_amount          numeric(12,2),
  deposit_paid_date       date,
  remaining_balance       numeric(12,2),
  invoice_date            date,
  payment_due_date        date,
  payment_status          po_payment_status NOT NULL DEFAULT 'not_due',
  invoice_id              uuid REFERENCES invoices(id) ON DELETE SET NULL,

  -- Documents — manifest of files in the private `purchase-orders` bucket:
  -- [{ path, name, type, size, category }]
  documents               jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Integration / meta
  slack_channel_id        text,
  slack_message_ts        text,
  slack_thread_ts         text,
  inventory_item_id       uuid,                                   -- future inventory link (no FK yet)
  created_by_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  status_changed_at       timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_orders_status_idx   ON purchase_orders (status);
CREATE INDEX purchase_orders_buyer_idx    ON purchase_orders (assigned_buyer_id);
CREATE INDEX purchase_orders_vendor_idx   ON purchase_orders (vendor_id);
CREATE INDEX purchase_orders_project_idx  ON purchase_orders (project_id);
CREATE INDEX purchase_orders_needed_idx   ON purchase_orders (needed_by);
CREATE INDEX purchase_orders_due_idx      ON purchase_orders (payment_due_date);
CREATE INDEX purchase_orders_created_idx  ON purchase_orders (created_at DESC);

-- ── Events / history ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  event_type          text NOT NULL DEFAULT 'status_change',  -- status_change | note | slack_action | field_update
  source              text NOT NULL DEFAULT 'app',            -- app | slack | cron | system
  previous_status     po_status,
  new_status          po_status,
  changed_by_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_order_events_po_idx ON purchase_order_events (purchase_order_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE purchase_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_events ENABLE ROW LEVEL SECURITY;

-- Orders: everyone authenticated can see all (visibility goal) + create a request;
-- admin/office manage everything; creator may edit their own while still a new request.
CREATE POLICY "purchase_orders: authenticated read" ON purchase_orders FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "purchase_orders: insert authenticated" ON purchase_orders FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "purchase_orders: update admin/office" ON purchase_orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','office')));
CREATE POLICY "purchase_orders: update own new request" ON purchase_orders FOR UPDATE
  USING (created_by_id = auth.uid() AND status = 'new_request');
CREATE POLICY "purchase_orders: delete admin" ON purchase_orders FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Events: read for any authenticated; insert by authenticated (server actions run
-- under the user context; cron/slack use the service client which bypasses RLS).
CREATE POLICY "purchase_order_events: authenticated read" ON purchase_order_events FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "purchase_order_events: insert authenticated" ON purchase_order_events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ── Storage bucket for documents (private; signed URLs) ──────
INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-orders', 'purchase-orders', false)
ON CONFLICT (id) DO NOTHING;
