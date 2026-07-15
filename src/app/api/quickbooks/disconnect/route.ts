/**
 * POST /api/quickbooks/disconnect?realmId=...
 *
 * Disconnect a realm: revoke the refresh token at Intuit (best-effort), then
 * drop the local token row. Admin-gated.
 */

import { NextRequest, NextResponse } from "next/server";
import { QUICKBOOKS, quickbooksEnv } from "@/lib/integrations/quickbooks/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("not signed in", { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return new NextResponse("admin only", { status: 403 });

  const realmId = new URL(req.url).searchParams.get("realmId");
  if (!realmId) {
    return NextResponse.json({ ok: false, error: "missing realmId" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("quickbooks_oauth_tokens")
    .select("refresh_token")
    .eq("realm_id", realmId)
    .single();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "realm not found" }, { status: 404 });
  }

  const { clientId, clientSecret } = quickbooksEnv();
  const auth = "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  try {
    await fetch(QUICKBOOKS.revokeUrl, {
      method: "POST",
      headers: {
        Authorization: auth,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: data.refresh_token }),
    });
  } catch {
    // Revoke is best-effort; we still drop the row locally so the UI stops
    // showing a stale connection.
  }

  await sb.from("quickbooks_oauth_tokens").delete().eq("realm_id", realmId);

  if (req.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(
      new URL("/admin/finance/settings?quickbooks=disconnected", req.url),
      303,
    );
  }
  return NextResponse.json({ ok: true });
}
