/**
 * Sync Jobber visits into the local mirror (public.jobber_visits).
 *
 * syncVisitsInRange() — paginated bulk pull over a date window. Used to
 *                       prime today / this-week views.
 * syncVisit()         — single-record pull. Used by the webhook handler
 *                       when Jobber notifies us a visit changed.
 */

import { gql } from "graphql-request";
import { jobberClient } from "@/lib/jobber/graphql";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Jobber's Visit schema (verified via introspection of VisitFilterAttributes
// and confirmed by multiple integrations): id, title, startAt, endAt,
// isComplete, completedAt, allDay, client { id }, job { id },
// assignedUsers { nodes { id } }. Property is NOT a direct field on Visit —
// it hangs off Job, so reach it via job { property { id } } when needed.
const VISIT_FIELDS = gql`
  fragment VisitFields on Visit {
    id
    title
    startAt
    endAt
    allDay
    isComplete
    completedAt
    client { id }
    job { id }
    assignedUsers { nodes { id } }
  }
`;

const VISITS_IN_RANGE = gql`
  ${VISIT_FIELDS}
  query VisitsInRange($cursor: String, $startMin: ISO8601DateTime!, $startMax: ISO8601DateTime!) {
    visits(
      first: 100
      after: $cursor
      filter: { startAt: { after: $startMin, before: $startMax } }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes { ...VisitFields }
    }
  }
`;

const ONE_VISIT = gql`
  ${VISIT_FIELDS}
  query OneVisit($id: EncodedId!) {
    visit(id: $id) { ...VisitFields }
  }
`;

type GqlVisit = {
  id: string;
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  isComplete: boolean;
  completedAt: string | null;
  client: { id: string } | null;
  job: { id: string } | null;
  assignedUsers: { nodes: { id: string }[] };
};

function toRow(accountId: string, v: GqlVisit) {
  return {
    id:                v.id,
    jobber_account_id: accountId,
    job_id:            v.job?.id ?? null,
    client_id:         v.client?.id ?? null,
    // property_id derived later via job -> property; keep column for the mirror
    // schema but always null at sync time for now.
    property_id:       null,
    title:             v.title,
    starts_at:         v.startAt,
    ends_at:           v.endAt,
    is_complete:       v.isComplete,
    assigned_user_ids: v.assignedUsers.nodes.map((u) => u.id),
    raw:               v,
    synced_at:         new Date().toISOString(),
  };
}

export async function syncVisitsInRange(
  accountId: string,
  startMin: Date,
  startMax: Date,
) {
  const client = await jobberClient(accountId);
  const supa = supabaseAdmin();
  let cursor: string | null = null;
  let total = 0;
  do {
    const resp: {
      visits: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: GqlVisit[];
      };
    } = await client.request(VISITS_IN_RANGE, {
      cursor,
      startMin: startMin.toISOString(),
      startMax: startMax.toISOString(),
    });
    const rows = resp.visits.nodes.map((n) => toRow(accountId, n));
    if (rows.length > 0) {
      const { error } = await supa
        .from("jobber_visits")
        .upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      total += rows.length;
    }
    cursor = resp.visits.pageInfo.hasNextPage ? resp.visits.pageInfo.endCursor : null;
  } while (cursor);
  return total;
}

export async function syncVisit(accountId: string, visitId: string) {
  const client = await jobberClient(accountId);
  const resp = await client.request<{ visit: GqlVisit | null }>(
    ONE_VISIT,
    { id: visitId },
  );
  if (!resp.visit) return;
  const { error } = await supabaseAdmin()
    .from("jobber_visits")
    .upsert(toRow(accountId, resp.visit), { onConflict: "id" });
  if (error) throw new Error(error.message);
}
