/**
 * Sync Jobber jobs into the local mirror (public.jobber_jobs).
 *
 * syncAllJobs() — paginated bulk pull. Used for the initial seed and any
 *                 periodic re-sync.
 * syncJob()    — single-record pull. Triggered by the webhook handler on
 *                JOB_CREATE / JOB_UPDATE.
 *
 * Throttle-aware: routed through jobberQuery() so the bucket doesn't drain
 * mid-pagination.
 */

import { gql } from "graphql-request";
import { jobberClient, jobberQuery } from "@/lib/jobber/graphql";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Verified Job fields (printing-press CLI schema brief + multiple in-the-wild
// integrations): id, jobNumber, title, jobStatus, createdAt, updatedAt,
// startAt, endAt, completedAt, total, client { id }, property { id }.
const JOB_FIELDS = gql`
  fragment JobFields on Job {
    id
    jobNumber
    title
    jobStatus
    createdAt
    updatedAt
    startAt
    endAt
    completedAt
    total
    client { id }
    property { id }
  }
`;

const ALL_JOBS = gql`
  ${JOB_FIELDS}
  query AllJobs($cursor: String) {
    jobs(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes { ...JobFields }
    }
  }
`;

const ONE_JOB = gql`
  ${JOB_FIELDS}
  query OneJob($id: EncodedId!) {
    job(id: $id) { ...JobFields }
  }
`;

type GqlJob = {
  id: string;
  jobNumber: number | string | null;
  title: string | null;
  jobStatus: string | null;
  createdAt: string;
  updatedAt: string;
  startAt: string | null;
  endAt: string | null;
  completedAt: string | null;
  total: number | null;
  client: { id: string } | null;
  property: { id: string } | null;
};

function toRow(accountId: string, j: GqlJob) {
  return {
    id:                 j.id,
    jobber_account_id:  accountId,
    job_number:         j.jobNumber == null ? null : String(j.jobNumber),
    title:              j.title,
    status:             j.jobStatus,
    start_at:           j.startAt,
    end_at:             j.endAt,
    completed_at:       j.completedAt,
    total_cents:        j.total == null ? null : Math.round(j.total * 100),
    client_id:          j.client?.id ?? null,
    property_id:        j.property?.id ?? null,
    jobber_created_at:  j.createdAt,
    jobber_updated_at:  j.updatedAt,
    raw:                j,
    synced_at:          new Date().toISOString(),
  };
}

export async function syncAllJobs(accountId: string) {
  const client = await jobberClient(accountId);
  const supa = supabaseAdmin();
  type Resp = {
    jobs: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: GqlJob[];
    };
  };
  let cursor: string | null = null;
  let total = 0;
  do {
    const resp: Resp = await jobberQuery<Resp>(client, ALL_JOBS, { cursor });
    const rows = resp.jobs.nodes.map((n) => toRow(accountId, n));
    if (rows.length > 0) {
      const { error } = await supa
        .from("jobber_jobs")
        .upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      total += rows.length;
    }
    cursor = resp.jobs.pageInfo.hasNextPage ? resp.jobs.pageInfo.endCursor : null;
  } while (cursor);
  return total;
}

export async function syncJob(accountId: string, jobId: string) {
  const client = await jobberClient(accountId);
  const resp = await jobberQuery<{ job: GqlJob | null }>(
    client,
    ONE_JOB,
    { id: jobId },
  );
  if (!resp.job) return;
  const { error } = await supabaseAdmin()
    .from("jobber_jobs")
    .upsert(toRow(accountId, resp.job), { onConflict: "id" });
  if (error) throw new Error(error.message);
}
