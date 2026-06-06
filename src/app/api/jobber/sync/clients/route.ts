/**
 * POST /api/jobber/sync/clients?account=<jobber_account_id>
 *
 * Manual full re-sync of every Jobber client into our local mirror.
 * Use for the initial seed (first install) or after an outage.
 *
 * Admin-only. The settings page triggers this from a button.
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllClients } from "@/lib/jobber/sync/clients";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const accountId = new URL(req.url).searchParams.get("account");
  if (!accountId) return NextResponse.json({ error: "missing account" }, { status: 400 });

  try {
    const count = await syncAllClients(accountId);
    return NextResponse.json({ synced: count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
