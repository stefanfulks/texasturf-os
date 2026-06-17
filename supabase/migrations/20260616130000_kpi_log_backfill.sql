-- Backfill the one historical entry that existed in the Nates_KPI_Tracker
-- Google Sheet (Equipment & Facilities tab) before the in-app KPI log shipped.
--
-- created_by must reference a real auth.users row. Prefer Nate's account if
-- one exists; fall back to the first admin so the row can be attributed.
-- Idempotent: re-running is a no-op (guarded by an existence check on the
-- payload + date).

do $$
declare
  v_user_id uuid;
begin
  -- Try Nate first (email pattern match — flexible since exact handle unknown).
  select id into v_user_id
    from auth.users
   where email ilike 'nate%@texasturfusa.com'
   limit 1;

  -- Fall back to the first admin.
  if v_user_id is null then
    select u.id into v_user_id
      from auth.users u
      join public.profiles p on p.id = u.id
     where p.role = 'admin'
     order by u.created_at
     limit 1;
  end if;

  if v_user_id is null then
    raise notice 'kpi_log backfill skipped: no auth.users row available for created_by';
    return;
  end if;

  -- Guard against duplicate insert on re-run.
  if exists (
    select 1
      from public.kpi_log_entries
     where section_id = 'equipment'
       and entry_date = date '2026-06-05'
       and payload->>'equipment' = 'Woody'
  ) then
    raise notice 'kpi_log backfill skipped: row already present';
    return;
  end if;

  insert into public.kpi_log_entries
    (section_id, entry_date, payload, pass_fail, notes, created_by)
  values
    (
      'equipment',
      date '2026-06-05',
      jsonb_build_object(
        'equipment',    'Woody',
        'issue_type',   'Maintenance',
        'duration',     '11 days',
        'pm_completed', 'Y'
      ),
      'pass',
      'Added metal bed to Woody — had to wait for Nick to weld.',
      v_user_id
    );
end $$;
