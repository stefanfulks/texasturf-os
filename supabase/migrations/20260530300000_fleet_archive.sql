-- ============================================================
-- Fleet assets: archive / retire flag.
--
-- The existing asset_status enum includes 'out_of_service' which means
-- "broken but might come back into rotation." Archive is the explicit
-- soft-delete: retired, sold, disposed — should not appear in normal
-- fleet views anymore.
-- ============================================================

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS assets_archived_idx ON assets (archived);
