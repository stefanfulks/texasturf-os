/**
 * Google OAuth token management for the current user.
 *
 * Supabase Auth returns provider_token + provider_refresh_token only at
 * the OAuth code-exchange moment. We capture them in /auth/callback and
 * persist to profiles. From then on:
 *
 *   getValidGoogleAccessToken(userId)
 *     → returns a non-expired access token, refreshing on demand.
 *
 * Refresh uses Google's token endpoint with the stored refresh_token
 * plus GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET (the same
 * credentials Supabase uses for the OAuth flow).
 */

import { createServiceClient } from "@/lib/supabase/service";

type StoredGoogleTokens = {
  google_access_token:    string | null;
  google_refresh_token:   string | null;
  google_token_expires_at: string | null;
};

export type GoogleTokenStatus =
  | { ok: true;  accessToken: string }
  | { ok: false; reason: "no_tokens" | "no_refresh_token" | "refresh_failed" | "config_missing"; detail?: string };

/**
 * Save tokens captured during /auth/callback. expiresIn is the value
 * Google / Supabase returns (seconds until expiry).
 */
export async function saveGoogleTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number | null,
): Promise<void> {
  const expiresAt = expiresIn != null
    ? new Date(Date.now() + (expiresIn - 60) * 1000).toISOString() // 60s safety margin
    : null;

  const service = createServiceClient();
  const patch: Record<string, unknown> = {
    google_access_token:    accessToken,
    google_token_expires_at: expiresAt,
  };
  // Only overwrite the refresh_token if Google gave us a fresh one.
  // Google omits refresh_token on subsequent sign-ins unless prompt=consent
  // was passed (which we do), but be defensive.
  if (refreshToken) patch.google_refresh_token = refreshToken;

  await service.from("profiles").update(patch as never).eq("id", userId);
}

/**
 * Get a valid access token for the user. Refreshes via Google's OAuth
 * endpoint if the stored token is missing or expired.
 */
export async function getValidGoogleAccessToken(userId: string): Promise<GoogleTokenStatus> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select("google_access_token, google_refresh_token, google_token_expires_at")
    .eq("id", userId)
    .single() as unknown as { data: StoredGoogleTokens | null; error: { message: string } | null };

  if (error || !data) return { ok: false, reason: "no_tokens", detail: error?.message };
  if (!data.google_access_token && !data.google_refresh_token) {
    return { ok: false, reason: "no_tokens" };
  }

  // Still valid?
  if (data.google_access_token && data.google_token_expires_at) {
    const exp = new Date(data.google_token_expires_at).getTime();
    if (Date.now() < exp) {
      return { ok: true, accessToken: data.google_access_token };
    }
  } else if (data.google_access_token && !data.google_token_expires_at) {
    // We have a token but no expiry — try it first.
    return { ok: true, accessToken: data.google_access_token };
  }

  // Expired or missing → refresh
  if (!data.google_refresh_token) {
    return { ok: false, reason: "no_refresh_token" };
  }
  return refreshAccessToken(userId, data.google_refresh_token);
}

async function refreshAccessToken(
  userId: string,
  refreshToken: string,
): Promise<GoogleTokenStatus> {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      reason: "config_missing",
      detail: "Set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET in Vercel — same creds Supabase uses.",
    };
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    // If the refresh token is invalid/revoked, clear it so we don't keep
    // trying — user will need to sign out + back in.
    if (resp.status === 400 || resp.status === 401) {
      const service = createServiceClient();
      await service.from("profiles").update({
        google_access_token:    null,
        google_refresh_token:   null,
        google_token_expires_at: null,
      } as never).eq("id", userId);
    }
    return { ok: false, reason: "refresh_failed", detail: `Google returned ${resp.status}: ${detail.slice(0, 200)}` };
  }

  const tokens = (await resp.json()) as {
    access_token: string;
    expires_in?:  number;
  };
  await saveGoogleTokens(userId, tokens.access_token, null, tokens.expires_in ?? null);
  return { ok: true, accessToken: tokens.access_token };
}
