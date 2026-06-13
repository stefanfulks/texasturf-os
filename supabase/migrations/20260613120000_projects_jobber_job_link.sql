-- Link an OS project (job) to its Jobber job for cross-module visibility.
--
-- Additive + nullable, so existing rows are untouched. Following the same
-- pattern as marketing_reviews.jobber_job_id, we DO NOT add a foreign key:
-- jobber_jobs is a sync-owned mirror whose rows churn on re-sync, and an FK
-- would break those syncs. The column stores jobber_jobs.id (text).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS jobber_job_id text;

CREATE INDEX IF NOT EXISTS projects_jobber_job_id_idx
  ON public.projects (jobber_job_id);
