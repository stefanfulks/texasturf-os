-- TexasTurf OS — Jobber invoices mirror.
--
-- Mirrors Jobber's Invoice entity so reporting can show real billing
-- (invoiced, collected, outstanding A/R) alongside job data without
-- hitting Jobber on page load. The cron seeds and refreshes it; webhooks
-- (INVOICE_CREATE / INVOICE_UPDATE / INVOICE_DESTROY) keep it live once
-- subscribed. Read scope verified live 2026-07-10 (read_invoices).
--
-- Money columns are bigint cents (invoice totals routinely exceed the
-- int4-safe dollar range across sums). No FK on client_id — matches the
-- jobber_jobs posture so an invoice can land before its client mirrors.

create table if not exists public.jobber_invoices (
  id                   text primary key,
  jobber_account_id    text not null references public.jobber_oauth_tokens(jobber_account_id) on delete cascade,
  invoice_number       text,
  subject              text,
  status               text,
  total_cents          bigint,
  balance_cents        bigint,
  deposit_cents        bigint,
  payments_total_cents bigint,
  issued_date          timestamptz,
  due_date             timestamptz,
  received_date        timestamptz,
  client_id            text,
  jobber_created_at    timestamptz,
  jobber_updated_at    timestamptz,
  raw                  jsonb,
  synced_at            timestamptz not null default now()
);

create index if not exists jobber_invoices_account_idx on public.jobber_invoices(jobber_account_id);
create index if not exists jobber_invoices_client_idx  on public.jobber_invoices(client_id);
create index if not exists jobber_invoices_status_idx  on public.jobber_invoices(status);
create index if not exists jobber_invoices_issued_idx  on public.jobber_invoices(issued_date);

alter table public.jobber_invoices enable row level security;

-- Match jobber_jobs / jobber_clients posture: all staff can read.
drop policy if exists "jobber_invoices read" on public.jobber_invoices;
create policy "jobber_invoices read"
  on public.jobber_invoices for select
  to authenticated using (true);
