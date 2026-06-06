export const JOBBER = {
  authorizeUrl: "https://api.getjobber.com/api/oauth/authorize",
  tokenUrl: "https://api.getjobber.com/api/oauth/token",
  graphqlUrl: "https://api.getjobber.com/api/graphql",
  apiVersion: "2024-04-01",
} as const;

export function jobberEnv() {
  const clientId = process.env.JOBBER_CLIENT_ID;
  const clientSecret = process.env.JOBBER_CLIENT_SECRET;
  const redirectUri = process.env.JOBBER_REDIRECT_URI;
  const scopes = (process.env.JOBBER_SCOPES ?? "").split(/\s+/).filter(Boolean);
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Jobber env missing: JOBBER_CLIENT_ID, JOBBER_CLIENT_SECRET, JOBBER_REDIRECT_URI",
    );
  }
  return { clientId, clientSecret, redirectUri, scopes };
}
