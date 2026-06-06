import { gql } from "graphql-request";
import { jobberClient } from "@/lib/jobber/graphql";
import { supabaseAdmin } from "@/lib/supabase/server";

const CLIENT_FIELDS = gql`
  fragment ClientFields on Client {
    id
    firstName
    lastName
    companyName
    isArchived
    createdAt
    updatedAt
    emails { description address }
    phoneNumbers { description number }
    balance
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
  emails: { description: string | null; address: string }[];
  phoneNumbers: { description: string | null; number: string }[];
  balance: number | null;
};

function toRow(accountId: string, c: GqlClient) {
  return {
    id: c.id,
    jobber_account_id: accountId,
    first_name: c.firstName,
    last_name: c.lastName,
    company_name: c.companyName,
    emails: c.emails,
    phones: c.phoneNumbers,
    balance_cents: c.balance == null ? null : Math.round(c.balance * 100),
    is_archived: c.isArchived,
    jobber_created_at: c.createdAt,
    jobber_updated_at: c.updatedAt,
    raw: c,
    synced_at: new Date().toISOString(),
  };
}

export async function syncAllClients(accountId: string) {
  const client = await jobberClient(accountId);
  const sb = supabaseAdmin();
  let cursor: string | null = null;
  let total = 0;
  do {
    const resp: { clients: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GqlClient[] } } =
      await client.request(ALL_CLIENTS, { cursor });
    const rows = resp.clients.nodes.map((n) => toRow(accountId, n));
    if (rows.length > 0) {
      const { error } = await sb
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
  const resp = await client.request<{ client: GqlClient | null }>(ONE_CLIENT, { id: clientId });
  if (!resp.client) return;
  const { error } = await supabaseAdmin()
    .from("jobber_clients")
    .upsert(toRow(accountId, resp.client), { onConflict: "id" });
  if (error) throw new Error(error.message);
}
