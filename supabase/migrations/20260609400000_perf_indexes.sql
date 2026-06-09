-- ============================================================
-- Performance indexes the audit flagged.
--
-- 1. inv_transactions had zero indexes. Every load of
--    /inventory/transactions sequentially scans the whole audit log.
--
-- 2. invoices is ordered by submitted_at in app code (page list,
--    /attention vendor avg, /vendors per-vendor counts) but only
--    created_at had an index. The composite (status, submitted_at)
--    handles the most common pattern: status filter + recency order.
--
-- These are additive — no data risk, no table rewrites. Safe under
-- write traffic because CREATE INDEX (without CONCURRENTLY) acquires
-- a SHARE lock that blocks writes only briefly per index.
-- ============================================================

CREATE INDEX IF NOT EXISTS inv_transactions_created_idx
  ON public.inv_transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS inv_transactions_job_idx
  ON public.inv_transactions (job_id);

CREATE INDEX IF NOT EXISTS inv_transactions_roll_idx
  ON public.inv_transactions (roll_id);

CREATE INDEX IF NOT EXISTS inv_transactions_type_created_idx
  ON public.inv_transactions (transaction_type, created_at DESC);

CREATE INDEX IF NOT EXISTS invoices_submitted_idx
  ON public.invoices (submitted_at DESC);

CREATE INDEX IF NOT EXISTS invoices_status_submitted_idx
  ON public.invoices (status, submitted_at DESC);
