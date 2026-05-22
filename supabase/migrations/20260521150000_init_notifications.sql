-- ============================================================
-- Notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type          text NOT NULL,          -- 'task_assigned' | 'task_commented' | 'task_status_changed' | 'task_due_soon'
  title         text NOT NULL,
  body          text,
  resource_type text,                   -- 'task' | 'project'
  resource_id   uuid,
  read          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread ON notifications (user_id, read, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "notifications: own read"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "notifications: own update"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Service-role / triggers insert (no user policy needed for INSERT when using service role)
-- But we also need authenticated inserts from server actions:
CREATE POLICY "notifications: server insert"
  ON notifications FOR INSERT
  WITH CHECK (true);
