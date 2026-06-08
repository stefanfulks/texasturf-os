/**
 * POST /api/jobber/sync/jobs?account=<id>
 *
 * Manual full re-sync of Jobber jobs. Use after initial install or when a
 * webhook delivery was missed. Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllJobs } from "@/lib/jobber/sync/jobs";
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
  if (!accountId) {
    return NextResponse.json({ error: "missing account" }, { status: 400 });
  }

  try {
    const count = await syncAllJobs(accountId);
    return NextResponse.json({ synced: count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
