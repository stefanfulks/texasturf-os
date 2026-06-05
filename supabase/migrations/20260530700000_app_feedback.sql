-- ============================================================
-- App feedback — internal users submit bugs / ideas / questions about
-- TexasTurf OS itself. Admin triages them from /team or /admin/feedback.
-- ============================================================

CREATE TYPE feedback_category AS ENUM (
  'bug',
  'feature_request',
  'question',
  'other'
);

CREATE TYPE feedback_status AS ENUM (
  'new',
  'in_progress',
  'resolved',
  'wont_fix'
);

CREATE TABLE app_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category    feedback_category NOT NULL DEFAULT 'other',
  subject     text NOT NULL,
  body        text,
  page_url    text,                     -- where the user was when they submitted
  status      feedback_status NOT NULL DEFAULT 'new',
  admin_notes text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_feedback_user    ON app_feedback (user_id);
CREATE INDEX idx_app_feedback_status  ON app_feedback (status);
CREATE INDEX idx_app_feedback_created ON app_feedback (created_at DESC);

CREATE TRIGGER app_feedback_touch_updated_at
  BEFORE UPDATE ON app_feedback
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE app_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can insert their own feedback
CREATE POLICY "app_feedback: self insert"
  ON app_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can read their own; admins can read all
CREATE POLICY "app_feedback: self read"
  ON app_feedback FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "app_feedback: admin read all"
  ON app_feedback FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins can update (triage)
CREATE POLICY "app_feedback: admin update"
  ON app_feedback FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
