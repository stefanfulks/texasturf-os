/**
 * POST /api/quickbooks/sync?entity=pnl|all&year=2026
 *
 * Runs the QuickBooks → finance backbone sync. Callable two ways:
 *   * Vercel cron / scripts with the CRON_SECRET bearer (fail closed), or
 *   * a signed-in admin (the "Sync now" button in finance settings).
 *
 * Each entity logs its own fin_sync_log row (inside the sync writers); one
 * entity failing must not stop the rest.
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getConnectedRealm } from "@/lib/integrations/quickbooks/tokens";
import { syncPnlActuals } from "@/lib/integrations/quickbooks/sync/pnl";
import { createClient } from "@/lib/supabase/server";

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

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && constantTimeBearerEqual(req.headers.get("authorization"), cronSecret)) {
    return true;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin";
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const realm = await getConnectedRealm();
  if (!realm) {
    return NextResponse.json(
      { ok: false, error: "QuickBooks is not connected" },
      { status: 409 },
    );
  }

  const url = new URL(req.url);
  const entity = url.searchParams.get("entity") ?? "all";
  const now = new Date();
  const year = clampYear(url.searchParams.get("year"), now.getUTCFullYear());
  // Fiscal year to date (calendar-year fiscal year, matching fin_period).
  const startDate = `${year}-01-01`;
  const endDate =
    year === now.getUTCFullYear() ? now.toISOString().slice(0, 10) : `${year}-12-31`;

  const results: Record<string, { rows: number; error: string | null }> = {};

  if (entity === "pnl" || entity === "all") {
    results.pnl_actuals = await run(
      async () => (await syncPnlActuals(realm.realm_id, { startDate, endDate })).rows,
      "pnl_actuals",
    );
  }

  if (Object.keys(results).length === 0) {
    return NextResponse.json({ ok: false, error: `unknown entity '${entity}'` }, { status: 400 });
  }

  const failed = Object.values(results).filter((r) => r.error).length;
  return NextResponse.json(
    { ok: failed === 0, synced: results, range: { startDate, endDate }, timestamp: now.toISOString() },
    { status: failed === 0 ? 200 : 500 },
  );
}

function clampYear(raw: string | null, fallback: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 2020 || n > 2100) return fallback;
  return n;
}

async function run(
  fn: () => Promise<number>,
  entity: string,
): Promise<{ rows: number; error: string | null }> {
  try {
    return { rows: await fn(), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { sync: "quickbooks", entity } });
    return { rows: 0, error: message };
  }
}
