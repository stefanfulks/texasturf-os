/**
 * Sync Jobber clients into the local mirror (public.jobber_clients).
 *
 * syncAllClients() — paginated bulk pull. Use for the initial seed or a
 *                    periodic re-sync (cron). Returns count.
 * syncClient()    — single-record pull. Used by the webhook handler when
 *                   Jobber notifies us a client changed.
 */

import { gql } from "graphql-request";
import { jobberClient, jobberQuery } from "@/lib/jobber/graphql";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Jobber's Client schema:
//   emails: { address, primary, description }
//   phones: { number, primary, description, smsAllowed }   (NOT "phoneNumbers")
//   balance: stored on the account, not selected here per query-cost discipline.
const CLIENT_FIELDS = gql`
  fragment ClientFields on Client {
    id
    firstName
    lastName
    companyName
    isArchived
    createdAt
    updatedAt
    emails { address description primary }
    phones { number description primary }
  }
`;

const ALL_CLIENTS = gql`
  ${CLIENT_FIELDS}
  query AllClients($cursor: String) {
    clients(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes { ...ClientFields }
    }
  }
`;

const ONE_CLIENT = gql`
  ${CLIENT_FIELDS}
  query OneClient($id: EncodedId!) {
    client(id: $id) { ...ClientFields }
  }
`;

type GqlClient = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  emails: { address: string; description: string | null; primary: boolean }[];
  phones: { number: string; description: string | null; primary: boolean }[];
};

function toRow(accountId: string, c: GqlClient) {
  return {
    id:                 c.id,
    jobber_account_id:  accountId,
    first_name:         c.firstName,
    last_name:          c.lastName,
    company_name:       c.companyName,
    emails:             c.emails,
    phones:             c.phones,
    // balance not selected from Jobber for now — re-add when needed.
    balance_cents:      null,
    is_archived:        c.isArchived,
    jobber_created_at:  c.createdAt,
    jobber_updated_at:  c.updatedAt,
    raw:                c,
    synced_at:          new Date().toISOString(),
  };
}

export async function syncAllClients(accountId: string) {
  const client = await jobberClient(accountId);
  const supa = supabaseAdmin();
  type Resp = {
    clients: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: GqlClient[];
    };
  };
  let cursor: string | null = null;
  let total = 0;
  do {
    const resp: Resp = await jobberQuery<Resp>(client, ALL_CLIENTS, { cursor });
    const rows = resp.clients.nodes.map((n) => toRow(accountId, n));
    if (rows.length > 0) {
      const { error } = await supa
        .from("jobber_clients")
        .upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      total += rows.length;
    }
    cursor = resp.clients.pageInfo.hasNextPage ? resp.clients.pageInfo.endCursor : null;
  } while (cursor);
  return total;
}

export async function syncClient(accountId: string, clientId: string) {
  const client = await jobberClient(accountId);
  const resp = await jobberQuery<{ client: GqlClient | null }>(
    client,
    ONE_CLIENT,
    { id: clientId },
  );
  if (!resp.client) return;
  const { error } = await supabaseAdmin()
    .from("jobber_clients")
    .upsert(toRow(accountId, resp.client), { onConflict: "id" });
  if (error) throw new Error(error.message);
}
