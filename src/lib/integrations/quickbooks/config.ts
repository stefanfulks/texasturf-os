export const QUICKBOOKS = {
  authorizeUrl: "https://appcenter.intuit.com/connect/oauth2",
  tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
  revokeUrl: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
  apiBase: {
    sandbox: "https://sandbox-quickbooks.api.intuit.com",
    production: "https://quickbooks.api.intuit.com",
  },
  minorVersion: "70",
} as const;

export type QuickbooksEnvironment = "sandbox" | "production";

export function quickbooksEnv() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  const environment = (process.env.QUICKBOOKS_ENVIRONMENT ?? "sandbox") as QuickbooksEnvironment;
  const scopes = (process.env.QUICKBOOKS_SCOPES ?? "com.intuit.quickbooks.accounting")
    .split(/\s+/)
    .filter(Boolean);
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "QuickBooks env missing: QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REDIRECT_URI",
    );
  }
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error(`QUICKBOOKS_ENVIRONMENT must be 'sandbox' or 'production' (got ${environment})`);
  }
  return { clientId, clientSecret, redirectUri, scopes, environment };
}

export function quickbooksApiBase(environment: QuickbooksEnvironment): string {
  return QUICKBOOKS.apiBase[environment];
}
