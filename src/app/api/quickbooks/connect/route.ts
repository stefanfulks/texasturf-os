/**
 * GET /api/quickbooks/connect
 *
 * Kicks off the QuickBooks Online OAuth flow. Sets a short-lived CSRF cookie
 * and redirects to Intuit's authorize URL. Intuit redirects back to
 * /api/quickbooks/callback with ?code=...&state=...&realmId=...
 *
 * Gated to admins — only an admin should be installing the integration.
 */

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { QUICKBOOKS, quickbooksEnv } from "@/lib/integrations/quickbooks/config";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("not signed in", { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return new NextResponse("admin only", { status: 403 });

  const { clientId, redirectUri, scopes } = quickbooksEnv();
  const state = randomBytes(16).toString("hex");

  const url = new URL(QUICKBOOKS.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("quickbooks_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return res;
}
