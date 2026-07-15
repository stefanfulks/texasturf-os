/**
 * Daily QuickBooks full sync (P&L actuals, AR, AP, cash snapshot). Keeps the
 * finance cockpit's actuals fresh without anyone clicking "Sync now"; the
 * cockpit flags staleness (≥2 days) from fin_sync_log if this stops running.
 *
 * Authenticated by the shared CRON_SECRET bearer (fail closed). No-ops with
 * a 200 when QuickBooks isn't connected yet so the cron doesn't alarm before
 * the one-time install.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runQuickbooksSync } from "@/lib/integrations/quickbooks/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function constantTimeBearerEqual(authHeader: string | null, secret: string) {
  if (!authHeader) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !constantTimeBearerEqual(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runQuickbooksSync("all");
  if (!result.connected) {
    return NextResponse.json({
      ok: true,
      note: "no connected QuickBooks realm",
      timestamp: new Date().toISOString(),
    });
  }
  return NextResponse.json(
    { ...result, timestamp: new Date().toISOString() },
    { status: result.ok ? 200 : 500 },
  );
}
