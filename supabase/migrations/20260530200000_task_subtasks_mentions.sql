-- ============================================================
-- Task subtasks + @mention support
--
-- 1. tasks.parent_task_id  → links a task to its parent (subtask).
-- 2. task_comments.mentions → array of profile ids @-mentioned in the
--    comment body. Used by the notification trigger so mentioned users
--    get a notifications row when they're tagged.
-- ============================================================

-- Subtasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid
    REFERENCES tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

-- Comment mentions (array of profile ids)
ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

-- Helper view: when a comment is inserted with mentions, fan out
-- notifications. Kept idempotent — re-running drops + recreates.
CREATE OR REPLACE FUNCTION notify_task_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mention_id uuid;
  actor_name text;
  task_title text;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(full_name, split_part(email, '@', 1))
    INTO actor_name
    FROM profiles
   WHERE id = NEW.user_id;

  SELECT title INTO task_title FROM tasks WHERE id = NEW.task_id;

  FOREACH mention_id IN ARRAY NEW.mentions LOOP
    -- Skip self-mentions
    IF mention_id = NEW.user_id THEN
      CONTINUE;
    END IF;
    INSERT INTO notifications (user_id, actor_id, type, title, body, resource_type, resource_id)
    VALUES (
      mention_id,
      NEW.user_id,
      'task_mentioned',
      coalesce(actor_name, 'Someone') || ' mentioned you',
      task_title,
      'task',
      NEW.task_id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_comments_notify_mentions ON task_comments;
CREATE TRIGGER task_comments_notify_mentions
  AFTER INSERT ON task_comments
  FOR EACH ROW EXECUTE FUNCTION notify_task_mentions();
