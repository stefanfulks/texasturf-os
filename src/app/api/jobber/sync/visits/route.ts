/**
 * POST /api/jobber/sync/visits?account=<id>&days=7
 *
 * Manual re-sync of Jobber visits over a date window. Defaults to a 7-day
 * window centered on today. Use after an outage or when seeding the
 * today/agenda views for the first time.
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { syncVisitsInRange } from "@/lib/jobber/sync/visits";
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

  const url = new URL(req.url);
  const accountId = url.searchParams.get("account");
  const days = Number(url.searchParams.get("days") ?? "7");
  if (!accountId) return NextResponse.json({ error: "missing account" }, { status: 400 });

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - Math.floor(days / 2));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  try {
    const count = await syncVisitsInRange(accountId, start, end);
    return NextResponse.json({ synced: count, from: start, to: end });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
