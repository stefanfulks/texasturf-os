/**
 * QuickBooks Online OAuth token storage + refresh.
 *
 * Tokens live in public.quickbooks_oauth_tokens (one row per realm/company).
 * Access tokens are refreshed transparently with ~60s of headroom —
 * callers always get a valid token from getAccessToken().
 */

import { QUICKBOOKS, QuickbooksEnvironment, quickbooksEnv } from "./config";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Intuit token endpoint response. Refresh tokens rotate on every refresh —
// the new `refresh_token` value MUST be persisted or the next refresh will 401.
type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: "bearer";
};

export type StoredTokens = {
  realm_id: string;
  environment: QuickbooksEnvironment;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  refresh_expires_at: string;
  scopes: string[];
};

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = quickbooksEnv();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(QUICKBOOKS.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`QuickBooks token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = quickbooksEnv();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(QUICKBOOKS.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`QuickBooks token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function saveTokens(
  realmId: string,
  environment: QuickbooksEnvironment,
  tokens: TokenResponse,
  scopes: string[],
): Promise<StoredTokens> {
  const now = Date.now();
  const expiresAt = new Date(now + tokens.expires_in * 1000).toISOString();
  const refreshExpiresAt = new Date(now + tokens.x_refresh_token_expires_in * 1000).toISOString();
  const row = {
    realm_id: realmId,
    environment,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
    scopes,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin()
    .from("quickbooks_oauth_tokens")
    .upsert(row, { onConflict: "realm_id" });
  if (error) throw new Error(`Failed to save QuickBooks tokens: ${error.message}`);
  return row;
}

export type ConnectedRealm = {
  realm_id: string;
  environment: QuickbooksEnvironment;
  installed_at: string;
  updated_at: string;
  refresh_expires_at: string;
};

/** The single connected realm (we only ever install one company), or null. */
export async function getConnectedRealm(): Promise<ConnectedRealm | null> {
  const { data } = await supabaseAdmin()
    .from("quickbooks_oauth_tokens")
    .select("realm_id, environment, installed_at, updated_at, refresh_expires_at")
    .order("installed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ConnectedRealm | null) ?? null;
}

// Returns a valid access token, refreshing with ~60s of headroom.
export async function getAccessToken(realmId: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("quickbooks_oauth_tokens")
    .select("*")
    .eq("realm_id", realmId)
    .single();
  if (error || !data) {
    throw new Error(`No QuickBooks tokens for realm ${realmId}`);
  }
  const expiresAtMs = new Date(data.expires_at).getTime();
  if (expiresAtMs - Date.now() > 60_000) {
    return data.access_token;
  }
  const refreshed = await refreshTokens(data.refresh_token);
  const saved = await saveTokens(realmId, data.environment, refreshed, data.scopes ?? []);
  return saved.access_token;
}
