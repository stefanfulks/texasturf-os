import { NextRequest, NextResponse } from "next/server";
import { syncAllClients } from "@/lib/jobber/sync/clients";

// Manual full sync, e.g. on first install or after an outage.
// POST /api/jobber/sync/clients?account=<jobber_account_id>
export async function POST(req: NextRequest) {
  const accountId = new URL(req.url).searchParams.get("account");
  if (!accountId) return NextResponse.json({ error: "missing account" }, { status: 400 });
  const count = await syncAllClients(accountId);
  return NextResponse.json({ synced: count });
}
