-- TexasTurf Command Center: Warehouse storage bucket.
-- Single private bucket `warehouse` with subfolders by feature.
--
-- Path convention (enforced by app code, not DB):
--   warehouse/inspections/{inspection_id}/{filename}
--   warehouse/deliveries/{delivery_id}/{filename}
--   warehouse/maintenance/{maintenance_id}/{filename}
--   warehouse/purchases/{purchase_id}/{filename}
--   warehouse/pull-lists/{pull_list_id}/{filename}
--
-- Anything stored in warehouse_*.photo_url / .invoice_url / .receipt_url
-- should be a signed URL or a `warehouse/...` object path resolved at render time.

insert into storage.buckets (id, name, public)
values ('warehouse', 'warehouse', false)
on conflict (id) do nothing;

-- RLS posture matches the rest of the warehouse module:
--   - storage.objects already has RLS enabled by Supabase.
--   - Service role bypasses, so server-side uploads + signed URL minting work today.
--   - Browser anon gets nothing until Supabase Auth (Google SSO) is wired and
--     per-row policies are written against employee_id / app_metadata role.
--
-- When Auth lands, add policies along the lines of:
--   create policy "warehouse read for authed" on storage.objects
--     for select using (
--       bucket_id = 'warehouse' and auth.role() = 'authenticated'
--     );
--   create policy "warehouse write for authed" on storage.objects
--     for insert with check (
--       bucket_id = 'warehouse' and auth.role() = 'authenticated'
--     );
-- and tighten further by subfolder / role once Admin/Office/Field is in place.
