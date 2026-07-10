/**
 * Sync Jobber visits into the local mirror (public.jobber_visits).
 *
 * syncVisitsInRange() — paginated bulk pull over a date window. Used to
 *                       prime today / this-week views.
 * syncVisit()         — single-record pull. Used by the webhook handler
 *                       when Jobber notifies us a visit changed.
 */

import { gql } from "graphql-request";
import { jobberClient, jobberQuery } from "@/lib/jobber/graphql";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Jobber's Visit schema (verified via introspection of VisitFilterAttributes
// and confirmed by multiple integrations): id, title, startAt, endAt,
// isComplete, completedAt, allDay, client { id }, job { id },
// assignedUsers { nodes { id } }. Property is NOT a direct field on Visit —
// it hangs off Job, so reach it via job { property { id } } when needed.
// assignedUsers is intentionally NOT selected: the connected token lacks
// read_users, and Jobber "hides" the User objects with a GraphQL error that
// fails the whole request (verified live 2026-07-10). Re-add the selection
// (and the toRow mapping) once the app's scopes include read_users.
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
  }
`;

// first: 40, not 100 — Jobber prices this query by page size × nested
// connections, and 100 rows costs ~11.3k points against a 10k bucket
// maximum, i.e. it can never run (verified live 2026-07-10). 40 rows
// (~4.5k) fits with headroom.
const VISITS_IN_RANGE = gql`
  ${VISIT_FIELDS}
  query VisitsInRange($cursor: String, $startMin: ISO8601DateTime!, $startMax: ISO8601DateTime!) {
    visits(
      first: 40
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
    // Empty until the token gains read_users — see VISIT_FIELDS comment.
    assigned_user_ids: [],
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
  type Resp = {
    visits: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: GqlVisit[];
    };
  };
  let cursor: string | null = null;
  let total = 0;
  do {
    const resp: Resp = await jobberQuery<Resp>(client, VISITS_IN_RANGE, {
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
  const resp = await jobberQuery<{ visit: GqlVisit | null }>(
    client,
    ONE_VISIT,
    { id: visitId },
  );
  if (!resp.visit) return;
  const { error } = await supabaseAdmin()
    .from("jobber_visits")
    .upsert(toRow(accountId, resp.visit), { onConflict: "id" });
  if (error) throw new Error(error.message);
}
