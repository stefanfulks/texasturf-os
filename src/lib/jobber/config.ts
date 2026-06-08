/**
 * Jobber API config + env-var resolution.
 *
 * Required env vars in Vercel (server-side only, never expose to browser):
 *   JOBBER_CLIENT_ID       — from the Jobber developer dashboard
 *   JOBBER_CLIENT_SECRET   — from the Jobber developer dashboard
 *   JOBBER_REDIRECT_URI    — e.g. https://os.texasturfusa.com/api/jobber/callback
 *   JOBBER_SCOPES          — space-separated, e.g. "clients:read jobs:read"
 *   JOBBER_WEBHOOK_SECRET  — optional, falls back to JOBBER_CLIENT_SECRET
 */

export const JOBBER = {
  authorizeUrl: "https://api.getjobber.com/api/oauth/authorize",
  tokenUrl:     "https://api.getjobber.com/api/oauth/token",
  graphqlUrl:   "https://api.getjobber.com/api/graphql",
  // Jobber API versions are YYYY-MM-DD dates, published when breaking changes
  // ship. Each is supported for 12–18 months. Bump this when picking up new
  // schema features; check the changelog before changing.
  // https://developer.getjobber.com/docs/changelog/
  apiVersion:   "2026-04-22",
} as const;

export function jobberEnv() {
  const clientId     = process.env.JOBBER_CLIENT_ID;
  const clientSecret = process.env.JOBBER_CLIENT_SECRET;
  const redirectUri  = process.env.JOBBER_REDIRECT_URI;
  const scopes       = (process.env.JOBBER_SCOPES ?? "").split(/\s+/).filter(Boolean);
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Jobber env missing: JOBBER_CLIENT_ID, JOBBER_CLIENT_SECRET, JOBBER_REDIRECT_URI must be set in Vercel.",
    );
  }
  return { clientId, clientSecret, redirectUri, scopes };
}
