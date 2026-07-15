import { QUICKBOOKS, QuickbooksEnvironment, quickbooksApiBase } from "./config";
import { getAccessToken } from "./tokens";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Lightweight, typed-at-the-edge QBO REST client.
//
// QBO quirks worth knowing:
//   * Every request needs the bearer token AND the `minorversion` query param —
//     leaving it off silently changes response shapes between releases.
//   * Reads are POST-or-GET; we use GET for everything to keep it cacheable.
//   * The query endpoint (SELECT ... FROM Entity) maxes out at MAXRESULTS 1000.
//     We page using STARTPOSITION until QBO returns fewer than the page size.
//   * 429 / 5xx responses sometimes come back as plaintext, not JSON — the error
//     helper below handles both.

async function getEnvironment(realmId: string): Promise<QuickbooksEnvironment> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("quickbooks_oauth_tokens")
    .select("environment")
    .eq("realm_id", realmId)
    .single();
  if (error || !data) throw new Error(`No QuickBooks tokens for realm ${realmId}`);
  return data.environment as QuickbooksEnvironment;
}

export async function qbFetch(
  realmId: string,
  path: string,
  search: Record<string, string> = {},
): Promise<unknown> {
  const env = await getEnvironment(realmId);
  const token = await getAccessToken(realmId);
  const base = quickbooksApiBase(env);
  const url = new URL(`${base}/v3/company/${realmId}${path}`);
  url.searchParams.set("minorversion", QUICKBOOKS.minorVersion);
  for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`QuickBooks ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

export type QbQueryResult<T> = {
  QueryResponse: {
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  } & Record<string, T[] | undefined>;
  time: string;
};

// Runs a QBO SELECT query and pages through all results.
// `entity` is the QB entity name as it appears in the query response, e.g. "Invoice".
export async function qbQueryAll<T>(
  realmId: string,
  entity: string,
  where = "",
): Promise<T[]> {
  const pageSize = 1000;
  const results: T[] = [];
  let startPosition = 1;
  for (;;) {
    const query = `SELECT * FROM ${entity}${where ? ` WHERE ${where}` : ""} STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`;
    const json = (await qbFetch(realmId, "/query", { query })) as QbQueryResult<T>;
    const batch = (json.QueryResponse?.[entity] as T[] | undefined) ?? [];
    results.push(...batch);
    if (batch.length < pageSize) break;
    startPosition += pageSize;
  }
  return results;
}

// CompanyInfo is the "is this token alive?" probe and also exposes the
// legal name / country we surface in the settings UI.
export type QbCompanyInfo = {
  CompanyInfo: {
    CompanyName: string;
    LegalName?: string;
    Country?: string;
    FiscalYearStartMonth?: string;
  };
};

export async function qbCompanyInfo(realmId: string): Promise<QbCompanyInfo["CompanyInfo"]> {
  const json = (await qbFetch(realmId, `/companyinfo/${realmId}`)) as QbCompanyInfo;
  return json.CompanyInfo;
}
