-- Finance suite backbone. Additive. All tables admin-only (read + write).
-- Shared updated_at trigger function: fin_set_updated_at().

create or replace function public.fin_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ---- company settings (one row per fiscal year) -------------------------
create table if not exists public.fin_company_settings (
  fiscal_year               int primary key,
  company_name              text not null default 'Texas Turf',
  fiscal_year_start_date    date not null,
  standard_hours_per_year   int  not null default 2080,
  work_days_per_week        numeric(4,2) not null default 5,
  work_hours_per_day        numeric(4,2) not null default 8,
  total_credit_limit        numeric(14,2) not null default 0,
  current_utilization       numeric(10,4) not null default 0.75,
  goal_utilization          numeric(10,4) not null default 0.85,
  employee_overhead_uplift  numeric(10,4) not null default 0.60,
  annual_revenue_plan       numeric(14,2) not null default 0,
  notes                     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- chart of accounts ---------------------------------------------------
create table if not exists public.fin_account (
  id            text primary key,
  name          text not null,
  section       text not null check (section in ('income','other_direct','indirect_fixed','other_income','other_expense')),
  cost_behavior text not null check (cost_behavior in ('variable','fixed')),
  direct_type   text not null default 'na' check (direct_type in ('direct_labor','direct_materials','subcontractor','other_direct','na')),
  reclass_note  text,
  sort_order    int  not null default 0,
  active        boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- periods -------------------------------------------------------------
create table if not exists public.fin_period (
  id               uuid primary key default gen_random_uuid(),
  grain            text not null check (grain in ('week','month','quarter','year')),
  fiscal_year      int  not null,
  month            int,
  quarter          int,
  week_start_monday date,
  is_closed        boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists fin_period_unique_idx
  on public.fin_period (grain, fiscal_year, coalesce(month, 0), coalesce(week_start_monday, '1900-01-01'));

-- ---- account values (budget + actual per account per period) -------------
create table if not exists public.fin_account_value (
  id            uuid primary key default gen_random_uuid(),
  account_id    text not null references public.fin_account(id) on delete cascade,
  period_id     uuid not null references public.fin_period(id) on delete cascade,
  budget_amount numeric(14,2) not null default 0,
  actual_amount numeric(14,2) not null default 0,
  source        text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, period_id)
);

-- ---- business units + sales -------------------------------------------------
create table if not exists public.fin_business_unit (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  display_order int not null default 0,
  active        boolean not null default true,
  annual_budget numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_seasonality (
  id               uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.fin_business_unit(id) on delete cascade,
  scope            text not null default 'business_unit' check (scope in ('business_unit','company')),
  history_year     int not null,
  year_weight_pct  numeric(10,4) not null default 0,
  month            int not null,
  history_amount   numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_unit_id, history_year, month)
);

create table if not exists public.fin_sales_actual (
  id               uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.fin_business_unit(id) on delete cascade,
  fiscal_year      int not null,
  month            int not null,
  amount           numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_unit_id, fiscal_year, month)
);

-- ---- products + cost rates ----------------------------------------------
create table if not exists public.fin_product (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  sku                  text,
  category             text,
  raw_cost_per_sqft    numeric(10,4) not null default 0,
  roll_size            text,
  infill_type          text,
  linked_inv_product_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_cost_rate (
  id                  uuid primary key default gen_random_uuid(),
  key                 text not null,
  value               numeric(14,4) not null default 0,
  unit                text,
  effective_fiscal_year int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, effective_fiscal_year)
);

-- ---- labor ----------------------------------------------------------------
create table if not exists public.fin_labor_role (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_employee (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  start_date          date,
  role_id             uuid references public.fin_labor_role(id) on delete set null,
  tax_classification  text not null default 'W2' check (tax_classification in ('W2','1099')),
  pay_type            text not null default 'hourly' check (pay_type in ('hourly','salary')),
  current_pay         numeric(14,2) not null default 0,
  is_billable         boolean not null default true,
  state               text not null default 'TX',
  wc_category         text,
  benefits_annual     numeric(14,2) not null default 0,
  annual_ot_hours     numeric(10,2) not null default 0,
  bonus_annual        numeric(14,2) not null default 0,
  weeks_per_year      numeric(5,2)  not null default 52,
  hours_per_week      numeric(6,2)  not null default 40,
  pto_days            numeric(6,2)  not null default 0,
  sick_days           numeric(6,2)  not null default 0,
  vacation_days       numeric(6,2)  not null default 0,
  holiday_days        numeric(6,2)  not null default 0,
  shutdown_days       numeric(6,2)  not null default 0,
  linked_warehouse_employee_id uuid,
  linked_profile_id   uuid,
  active              boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_burden_rate (
  id            uuid primary key default gen_random_uuid(),
  fiscal_year   int not null,
  state         text not null default 'TX',
  fica_rate     numeric(10,4) not null default 0.062,
  fica_cap      numeric(14,2) not null default 176100,
  medicare_rate numeric(10,4) not null default 0.0145,
  futa_rate     numeric(10,4) not null default 0.06,
  futa_cap      numeric(14,2) not null default 7000,
  suta_rate     numeric(10,4) not null default 0,
  suta_cap      numeric(14,2) not null default 0,
  wc_category   text not null default 'default',
  wc_rate_per_100 numeric(10,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fiscal_year, state, wc_category)
);

-- ---- profit goal ----------------------------------------------------------
create table if not exists public.fin_profit_goal (
  id            uuid primary key default gen_random_uuid(),
  fiscal_year   int not null unique,
  taxes         numeric(14,2) not null default 0,
  current_lt_debt numeric(14,2) not null default 0,
  growth        numeric(14,2) not null default 0,
  capex         numeric(14,2) not null default 0,
  distributions numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- AR / AP / recurring / debt ------------------------------------------
create table if not exists public.fin_ar_invoice (
  id                    uuid primary key default gen_random_uuid(),
  customer              text not null,
  invoice_num           text,
  invoice_date          date,
  open_balance          numeric(14,2) not null default 0,
  due_date              date,
  terms                 text,
  expected_receipt_date date,
  funds_available_date  date,
  result                text not null default 'planned' check (result in ('planned','issue','paid','writeoff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_ap_bill (
  id               uuid primary key default gen_random_uuid(),
  vendor           text not null,
  bill_num         text,
  invoice_date     date,
  open_balance     numeric(14,2) not null default 0,
  due_date         date,
  terms            text,
  expected_pay_date date,
  payment_type     text not null default 'cash' check (payment_type in ('cash','credit')),
  source_invoice_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_recurring_cost (
  id                uuid primary key default gen_random_uuid(),
  category          text,
  description       text not null,
  frequency         text not null check (frequency in ('daily','weekly','biweekly','monthly','quarterly','annually')),
  last_payment_date date,
  amount            numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_debt (
  id              uuid primary key default gen_random_uuid(),
  lender          text not null,
  asset           text,
  current_balance numeric(14,2) not null default 0,
  monthly_payment numeric(14,2) not null default 0,
  interest_pct    numeric(10,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- cash snapshot --------------------------------------------------------
create table if not exists public.fin_cash_snapshot (
  id                    uuid primary key default gen_random_uuid(),
  period_id             uuid not null references public.fin_period(id) on delete cascade,
  starting_cash         numeric(14,2) not null default 0,
  starting_avail_credit numeric(14,2) not null default 0,
  total_credit_limit    numeric(14,2) not null default 0,
  ending_cash           numeric(14,2) not null default 0,
  ending_avail_credit   numeric(14,2) not null default 0,
  working_capital       numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id)
);

-- ---- KPI dictionary + values ---------------------------------------------
create table if not exists public.fin_metric (
  id              text primary key,
  label           text not null,
  metric_group    text not null,
  formula_text    text,
  plain_english   text,
  responsible_role text,
  unit            text,
  lower_is_better boolean not null default false,
  sort_order      int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_metric_value (
  id           uuid primary key default gen_random_uuid(),
  metric_id    text not null references public.fin_metric(id) on delete cascade,
  period_id    uuid not null references public.fin_period(id) on delete cascade,
  target_value numeric(18,4),
  actual_value numeric(18,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metric_id, period_id)
);

-- ---- change log -----------------------------------------------------------
create table if not exists public.fin_change_log (
  id         uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id     text,
  field      text,
  old_value  text,
  new_value  text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  reason     text
);

-- ---- indexes --------------------------------------------------------------
create index if not exists fin_account_value_period_idx on public.fin_account_value (period_id);
create index if not exists fin_period_lookup_idx on public.fin_period (grain, fiscal_year);
create index if not exists fin_metric_value_period_idx on public.fin_metric_value (period_id);
create index if not exists fin_change_log_table_idx on public.fin_change_log (table_name, changed_at desc);

-- ---- updated_at triggers --------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'fin_company_settings','fin_account','fin_period','fin_account_value',
    'fin_business_unit','fin_seasonality','fin_sales_actual','fin_product',
    'fin_cost_rate','fin_labor_role','fin_employee','fin_burden_rate',
    'fin_profit_goal','fin_ar_invoice','fin_ap_bill','fin_recurring_cost',
    'fin_debt','fin_cash_snapshot','fin_metric','fin_metric_value'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I;', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.fin_set_updated_at();', t, t);
  end loop;
end $$;

-- ---- RLS: admin-only (read + write) on every fin_ table -------------------
do $$
declare t text;
begin
  foreach t in array array[
    'fin_company_settings','fin_account','fin_period','fin_account_value',
    'fin_business_unit','fin_seasonality','fin_sales_actual','fin_product',
    'fin_cost_rate','fin_labor_role','fin_employee','fin_burden_rate',
    'fin_profit_goal','fin_ar_invoice','fin_ap_bill','fin_recurring_cost',
    'fin_debt','fin_cash_snapshot','fin_metric','fin_metric_value','fin_change_log'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_admin_all on public.%I;', t, t);
    execute format($f$create policy %I_admin_all on public.%I for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));$f$, t, t);
  end loop;
end $$;
