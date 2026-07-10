import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getJobberAccountId } from "@/lib/jobber/quotes";
import { syncAllClients } from "@/lib/jobber/sync/clients";
import { syncAllJobs } from "@/lib/jobber/sync/jobs";
import { syncVisitsInRange } from "@/lib/jobber/sync/visits";
import { syncAllInvoices } from "@/lib/jobber/sync/invoices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Full clients + jobs pagination plus a visit window can exceed the default
// function timeout once throttle pacing kicks in; give it the room it needs.
export const maxDuration = 300;

function constantTimeBearerEqual(authHeader: string | null, secret: string) {
  if (!authHeader) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Twice-daily Jobber full sync (morning + midday). Keeps the local mirrors
 * (clients, jobs, visits) fresh so agenda/reports/pitch always show current
 * Jobber data without anyone clicking "Sync." Webhooks keep it live between
 * runs; this is the safety net that backfills anything missed.
 *
 * Visits sync over a rolling window — default 30 days back / 90 forward.
 * One-time backfills can widen it: `?back=400&fwd=180`.
 *
 * Authenticated by the shared CRON_SECRET bearer (fail closed). The sync
 * helpers run on the service-role path and auto-refresh the Jobber token.
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
      synced: { clients: 0, jobs: 0, visits: 0 },
      note: "no connected Jobber account",
      timestamp: new Date().toISOString(),
    });
  }

  const url = new URL(request.url);
  const back = clampDays(url.searchParams.get("back"), 30);
  const fwd = clampDays(url.searchParams.get("fwd"), 90);
  const now = Date.now();
  const startMin = new Date(now - back * 86_400_000);
  const startMax = new Date(now + fwd * 86_400_000);

  // Strictly sequential: Jobber's leaky-bucket limit is shared per account,
  // so concurrent paginators just starve each other into THROTTLED errors
  // (verified live 2026-07-10). One entity failing must not stop the rest.
  const result = {
    clients: await run(() => syncAllClients(accountId), "clients"),
    jobs: await run(() => syncAllJobs(accountId), "jobs"),
    invoices: await run(() => syncAllInvoices(accountId), "invoices"),
    visits: await run(() => syncVisitsInRange(accountId, startMin, startMax), "visits"),
  };
  const failed = Object.values(result).filter((r) => r.error).length;

  return NextResponse.json(
    {
      ok: failed === 0,
      synced: result,
      window: { back, fwd },
      timestamp: new Date().toISOString(),
    },
    { status: failed === 0 ? 200 : 500 },
  );
}

function clampDays(raw: string | null, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.floor(n), 730);
}

async function run(
  fn: () => Promise<number>,
  entity: string,
): Promise<{ count: number; error: string | null }> {
  try {
    return { count: await fn(), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: "jobber-sync", entity } });
    return { count: 0, error: message };
  }
}
