/**
 * GET /api/jobber/callback?code=...&state=...
 *
 * Final step of the Jobber OAuth handshake. Validates the CSRF state,
 * exchanges the code for tokens, asks Jobber whose account it is, and
 * persists the tokens keyed by jobber_account_id.
 */

import { NextRequest, NextResponse } from "next/server";
import { GraphQLClient, gql } from "graphql-request";
import { JOBBER } from "@/lib/jobber/config";
import { exchangeCodeForTokens, saveTokens } from "@/lib/jobber/tokens";

const ACCOUNT_QUERY = gql`
  query CurrentAccount {
    account {
      id
      name
    }
  }
`;

type AccountResp = { account: { id: string; name: string } };

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code        = url.searchParams.get("code");
  const state       = url.searchParams.get("state");
  const cookieState = req.cookies.get("jobber_oauth_state")?.value;

  if (!code) return bad("missing code");
  if (!state || !cookieState || state !== cookieState) return bad("bad state");

  const tokens = await exchangeCodeForTokens(code);

  // Use the brand-new token to learn which Jobber account just authorized us.
  const client = new GraphQLClient(JOBBER.graphqlUrl, {
    headers: {
      authorization:             `bearer ${tokens.access_token}`,
      "X-JOBBER-GRAPHQL-VERSION": JOBBER.apiVersion,
    },
  });
  const { account } = await client.request<AccountResp>(ACCOUNT_QUERY);

  await saveTokens(account.id, tokens);

  const res = NextResponse.redirect(new URL("/settings/jobber?connected=1", req.url));
  res.cookies.delete("jobber_oauth_state");
  return res;
}

function bad(msg: string) {
  return new NextResponse(`OAuth error: ${msg}`, { status: 400 });
}
