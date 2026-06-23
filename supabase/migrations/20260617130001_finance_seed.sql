-- Finance seed. Idempotent. Structural data only.
-- IMPORTANT: this repo is PUBLIC. Real $ figures (revenue plan, credit limit,
-- profit goal, distributions, debt) are NOT seeded here — they are entered via
-- /admin/finance/settings and live only in the database. Amounts below are 0.

insert into public.fin_company_settings
  (fiscal_year, company_name, fiscal_year_start_date, total_credit_limit, annual_revenue_plan)
values (2026, 'Texas Turf', '2026-01-01', 0, 0)
on conflict (fiscal_year) do nothing;

insert into public.fin_profit_goal (fiscal_year, taxes, current_lt_debt, growth, capex, distributions)
values (2026, 0, 0, 0, 0, 0)
on conflict (fiscal_year) do nothing;

-- Chart of accounts (first-draft classification; CPA refines in Settings).
insert into public.fin_account (id, name, section, cost_behavior, direct_type, sort_order) values
  ('revenue',        'Sales / Revenue',        'income',          'variable', 'na',              10),
  ('cogs_materials', 'COGS — Materials',       'other_direct',    'variable', 'direct_materials',20),
  ('cogs_labor',     'COGS — Direct Labor',    'other_direct',    'variable', 'direct_labor',    30),
  ('subcontractor',  'Subcontractor',          'other_direct',    'variable', 'subcontractor',   40),
  ('wages_overhead', 'Wages — Overhead/Admin', 'indirect_fixed',  'fixed',    'na',              50),
  ('rent',           'Rent / Facilities',      'indirect_fixed',  'fixed',    'na',              60),
  ('insurance',      'Insurance',              'indirect_fixed',  'fixed',    'na',              70),
  ('franchise_tax',  'Franchise Tax',          'other_expense',   'fixed',    'na',              80),
  ('distributions',  'Owner Distributions',    'other_expense',   'fixed',    'na',              90)
on conflict (id) do nothing;

-- Business units (Sales is the worked example; rest are placeholders to confirm).
insert into public.fin_business_unit (name, display_order, annual_budget) values
  ('Sales', 10, 0), ('Residential', 20, 0), ('Commercial', 30, 0), ('Turf Casa', 40, 0),
  ('SBU5', 50, 0), ('SBU6', 60, 0), ('SBU7', 70, 0), ('SBU8', 80, 0), ('SBU9', 90, 0), ('SBU10', 100, 0)
on conflict do nothing;

insert into public.fin_labor_role (name, display_order) values
  ('Owner', 10), ('Operations Manager', 20), ('Sales Consultant', 30),
  ('Foreman', 40), ('Installer', 50), ('Apprentice', 60)
on conflict do nothing;

insert into public.fin_burden_rate (fiscal_year, state, wc_category) values (2026, 'TX', 'default')
on conflict (fiscal_year, state, wc_category) do nothing;

-- KPI dictionary (subset; module 06 fills the full 58). group + plain-English.
insert into public.fin_metric (id, label, metric_group, formula_text, plain_english, responsible_role, unit, lower_is_better, sort_order) values
  ('ending_cash',      'Ending Cash',            'WC',   'starting_cash + deposits - expenses', 'Cash on hand at week end',                 'Finance', 'USD', false, 10),
  ('working_capital',  'Ending Working Capital', 'WC',   'ending_cash + ending_avail_credit',   'Cash plus available credit at week end',   'Finance', 'USD', false, 20),
  ('gross_margin_pct', 'Gross Margin %',         'EBITDA','gross_profit / revenue',             'Share of revenue left after direct costs', 'Finance', '%',   false, 30),
  ('net_income',       'Net Income',             'EBITDA','total_income - total_expense',        'Bottom-line profit for the period',        'Finance', 'USD', false, 40),
  ('breakeven_attain', 'Break-even Attainment',  'Sales','revenue / break_even_revenue',        'Revenue vs the break-even line',           'Owner',   '%',   false, 50)
on conflict (id) do update set label = excluded.label, plain_english = excluded.plain_english;
