import { NextRequest, NextResponse } from "next/server";
import { syncVisitsInRange } from "@/lib/jobber/sync/visits";

// POST /api/jobber/sync/visits?account=<id>&days=7
// Defaults to a 7-day window centered on today.
export async function POST(req: NextRequest) {
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

  const count = await syncVisitsInRange(accountId, start, end);
  return NextResponse.json({ synced: count, from: start, to: end });
}
