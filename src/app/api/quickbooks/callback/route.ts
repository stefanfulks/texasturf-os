/**
 * GET /api/quickbooks/callback?code=...&state=...&realmId=...
 *
 * Final step of the QuickBooks OAuth handshake. Validates the CSRF state,
 * exchanges the code for tokens, and persists them keyed by realmId.
 */

import { NextRequest, NextResponse } from "next/server";
import { quickbooksEnv } from "@/lib/integrations/quickbooks/config";
import { exchangeCodeForTokens, saveTokens } from "@/lib/integrations/quickbooks/tokens";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const realmId = url.searchParams.get("realmId");
  const cookieState = req.cookies.get("quickbooks_oauth_state")?.value;

  if (!code) return bad("missing code");
  if (!realmId) return bad("missing realmId");
  if (!state || !cookieState || state !== cookieState) return bad("bad state");

  const { environment, scopes } = quickbooksEnv();
  const tokens = await exchangeCodeForTokens(code);
  await saveTokens(realmId, environment, tokens, scopes);

  const res = NextResponse.redirect(new URL("/admin/finance/settings?quickbooks=connected", req.url));
  res.cookies.delete("quickbooks_oauth_state");
  return res;
}

function bad(msg: string) {
  return new NextResponse(`OAuth error: ${msg}`, { status: 400 });
}
