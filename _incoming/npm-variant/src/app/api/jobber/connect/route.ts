import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { JOBBER, jobberEnv } from "@/lib/jobber/config";

// Kick off Jobber OAuth. The user is redirected to Jobber to approve, then
// Jobber redirects to /api/jobber/callback with ?code=... and ?state=...
export async function GET() {
  const { clientId, redirectUri, scopes } = jobberEnv();
  const state = randomBytes(16).toString("hex");

  const url = new URL(JOBBER.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  if (scopes.length > 0) url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  // Short-lived CSRF cookie checked in the callback.
  res.cookies.set("jobber_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
