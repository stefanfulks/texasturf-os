/**
 * POST /api/quickbooks/sync?entity=pnl|ar|ap|cash|all&year=2026
 *
 * Runs the QuickBooks → finance backbone sync. Callable two ways:
 *   * scripts/one-offs with the CRON_SECRET bearer (fail closed), or
 *   * a signed-in admin (the "Sync now" button in finance settings).
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runQuickbooksSync, type SyncRunEntity } from "@/lib/integrations/quickbooks/sync";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const ENTITIES: SyncRunEntity[] = ["pnl", "ar", "ap", "cash", "all"];

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

  const url = new URL(req.url);
  const entity = (url.searchParams.get("entity") ?? "all") as SyncRunEntity;
  if (!ENTITIES.includes(entity)) {
    return NextResponse.json({ ok: false, error: `unknown entity '${entity}'` }, { status: 400 });
  }
  const year = clampYear(url.searchParams.get("year"));

  const result = await runQuickbooksSync(entity, year);
  if (!result.connected) {
    return NextResponse.json(
      { ok: false, error: "QuickBooks is not connected" },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { ...result, timestamp: new Date().toISOString() },
    { status: result.ok ? 200 : 500 },
  );
}

function clampYear(raw: string | null): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 2020 || n > 2100) return undefined;
  return n;
}
