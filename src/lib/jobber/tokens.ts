/**
 * Jobber OAuth token storage + refresh.
 *
 * Tokens live in public.jobber_oauth_tokens (one row per Jobber account).
 * Access tokens are refreshed transparently with ~60s of headroom before
 * the stored expires_at — callers always get a valid token from
 * getAccessToken().
 */

import { JOBBER, jobberEnv } from "./config";
import { supabaseAdmin } from "@/lib/supabase/admin";

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
};

export type StoredTokens = {
  jobber_account_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string[];
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = jobberEnv();
  const body = new URLSearchParams({
    grant_type:    "authorization_code",
    client_id:     clientId,
    client_secret: clientSecret,
    code,
    redirect_uri:  redirectUri,
  });
  const res = await fetch(JOBBER.tokenUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Jobber token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = jobberEnv();
  const body = new URLSearchParams({
    grant_type:    "refresh_token",
    client_id:     clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const res = await fetch(JOBBER.tokenUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Jobber token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function saveTokens(
  accountId: string,
  tokens: TokenResponse,
): Promise<StoredTokens> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const scopes = tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : [];
  const row = {
    jobber_account_id: accountId,
    access_token:      tokens.access_token,
    refresh_token:     tokens.refresh_token,
    expires_at:        expiresAt,
    scopes,
    updated_at:        new Date().toISOString(),
  };
  const { error } = await supabaseAdmin()
    .from("jobber_oauth_tokens")
    .upsert(row, { onConflict: "jobber_account_id" });
  if (error) throw new Error(`Failed to save tokens: ${error.message}`);
  return row;
}

/** Returns a valid access token, refreshing if it's within 60s of expiry. */
export async function getAccessToken(accountId: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("jobber_oauth_tokens")
    .select("*")
    .eq("jobber_account_id", accountId)
    .single();
  if (error || !data) {
    throw new Error(`No Jobber tokens for account ${accountId}`);
  }
  const expiresAtMs = new Date(data.expires_at).getTime();
  if (expiresAtMs - Date.now() > 60_000) {
    return data.access_token;
  }
  const refreshed = await refreshTokens(data.refresh_token);
  const saved = await saveTokens(accountId, refreshed);
  return saved.access_token;
}

/** True if at least one Jobber account is connected. UI uses this for status. */
export async function isConnected(): Promise<boolean> {
  const { count } = await supabaseAdmin()
    .from("jobber_oauth_tokens")
    .select("jobber_account_id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}
