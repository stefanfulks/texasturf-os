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
  // Jobber does NOT return expires_in. The expiration is encoded in the JWT
  // access token's `exp` claim. Kept here as optional so we can also handle
  // future API revisions that might add it.
  expires_in?: number;
  scope?: string;
};

/**
 * Read the `exp` claim from a JWT access token without verifying the
 * signature (we don't have Jobber's public key and don't need to — we got
 * this token from Jobber directly over TLS).
 * Returns null if the token isn't a parseable JWT.
 */
function jwtExpiryDate(accessToken: string): Date | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const claims = JSON.parse(payloadJson) as { exp?: number };
    if (typeof claims.exp !== "number") return null;
    return new Date(claims.exp * 1000);
  } catch {
    return null;
  }
}

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
  // Prefer the JWT `exp` claim (Jobber's documented behavior). Fall back to
  // expires_in if present, then to a 1-hour default — Jobber tokens live
  // ~60 min and the refresh loop will recover if we're slightly off.
  const expiresAt = (
    jwtExpiryDate(tokens.access_token) ??
    (typeof tokens.expires_in === "number"
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : new Date(Date.now() + 3600 * 1000))
  ).toISOString();
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
