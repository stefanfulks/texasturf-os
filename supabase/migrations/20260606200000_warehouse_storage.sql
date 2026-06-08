-- TexasTurf OS — Phase B1: Warehouse storage bucket.
--
-- Single private bucket `warehouse` for photos + receipts + invoices.
--
-- Path convention (enforced by app code, not DB):
--   warehouse/inspections/{inspection_id}/{filename}
--   warehouse/deliveries/{delivery_id}/{filename}
--   warehouse/maintenance/{maintenance_log_id}/{filename}
--   warehouse/purchases/{tool_purchase_id}/{filename}
--   warehouse/pull-lists/{pull_list_id}/{filename}
--
-- Anything stored in warehouse_*.photo_url / invoice_url / receipt_url /
-- maintenance_logs.invoice_url should be either a signed URL or a
-- `warehouse/...` object path resolved at render time.

insert into storage.buckets (id, name, public)
values ('warehouse', 'warehouse', false)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by Supabase. Service role bypasses
-- (so server-side uploads + signed-URL minting work today). We add explicit
-- per-action policies for authenticated users so the browser can read
-- warehouse objects directly without going through a server proxy.

drop policy if exists "warehouse read for authed" on storage.objects;
create policy "warehouse read for authed"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'warehouse');

-- Writes (insert/update/delete) require admin or office. We can't reach
-- public.current_role() from inside storage policies cleanly, so we inline
-- the role check.
drop policy if exists "warehouse write for office" on storage.objects;
create policy "warehouse write for office"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'warehouse'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'office')
    )
  )
  with check (
    bucket_id = 'warehouse'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'office')
    )
  );
