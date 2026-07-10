-- Jobber (and other external) resources use encoded string ids that don't fit
-- the uuid resource_id column. resource_ref carries those; resource_id stays
-- for internal uuid-keyed resources.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS resource_ref text;
