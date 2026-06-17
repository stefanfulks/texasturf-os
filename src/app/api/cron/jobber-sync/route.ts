import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getJobberAccountId } from "@/lib/jobber/quotes";
import { syncAllClients } from "@/lib/jobber/sync/clients";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function constantTimeBearerEqual(authHeader: string | null, secret: string) {
  if (!authHeader) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Twice-daily Jobber client sync (morning + midday). Keeps the local
 * jobber_clients mirror fresh so reps and the Pitch flow always see current
 * clients without anyone clicking "Sync." Webhooks keep it live between runs;
 * this is the safety net that backfills anything missed.
 *
 * Authenticated by the shared CRON_SECRET bearer (fail closed). The sync helper
 * runs on the service-role path and auto-refreshes the Jobber token.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || !constantTimeBearerEqual(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = await getJobberAccountId();
  if (!accountId) {
    return NextResponse.json({
      ok: true,
      synced: 0,
      note: "no connected Jobber account",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const synced = await syncAllClients(accountId);
    return NextResponse.json({ ok: true, synced, timestamp: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: "jobber-sync" } });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
