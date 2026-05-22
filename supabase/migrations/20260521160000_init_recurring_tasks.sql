-- ============================================================
-- Recurring task rules
-- ============================================================

CREATE TYPE recurrence_freq AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');

CREATE TABLE IF NOT EXISTS recurring_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  description      text,
  priority         task_priority NOT NULL DEFAULT 'normal',
  assignee_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES projects(id) ON DELETE SET NULL,
  department_id    uuid REFERENCES departments(id) ON DELETE SET NULL,
  visibility       task_visibility NOT NULL DEFAULT 'team',

  freq             recurrence_freq NOT NULL DEFAULT 'weekly',
  -- day_of_week: 0=Sun … 6=Sat — used for weekly/biweekly
  day_of_week      int CHECK (day_of_week BETWEEN 0 AND 6),
  -- day_of_month: 1-28 — used for monthly
  day_of_month     int CHECK (day_of_month BETWEEN 1 AND 28),
  -- days_before_due: how many days before due date to create the task (lead time)
  lead_days        int NOT NULL DEFAULT 0,

  active           boolean NOT NULL DEFAULT true,
  last_generated   date,   -- the due_date of the most recently generated task
  next_due         date,   -- when the next task should be created

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Track which tasks were generated from which rule
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS recurring_rule_id uuid REFERENCES recurring_rules(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_rules: authenticated read"
  ON recurring_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "recurring_rules: owner manage"
  ON recurring_rules FOR ALL
  USING (created_by_id = auth.uid() OR assignee_id = auth.uid());

CREATE POLICY "recurring_rules: admin manage"
  ON recurring_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'office')
    )
  );
