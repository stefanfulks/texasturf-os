import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import type { FeedbackAttachment } from "@/lib/db-helpers.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function constantTimeBearerEqual(authHeader: string | null, secret: string) {
  if (!authHeader) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Daily purge of soft-deleted feedback. Rows archived (deleted_at set) more
 * than 30 days ago are permanently removed, along with their uploaded
 * screenshots in the `feedback` bucket. Runs on the service-role client
 * (RLS-bypassing) — authenticated by the shared CRON_SECRET bearer.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || !constantTimeBearerEqual(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const { data: rows, error: selErr } = await supabase
    .from("app_feedback")
    .select("id, attachments")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff);

  if (selErr) {
    Sentry.captureMessage(`purge-feedback select failed: ${selErr.message}`, {
      level: "error",
      tags: { cron: "purge-feedback" },
    });
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  const ids = (rows ?? []).map((r) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, purged: 0, files: 0, timestamp: new Date().toISOString() });
  }

  // Best-effort: clear the screenshots first, then the rows. Orphaned files
  // are recoverable; stale rows are the priority, so a storage error doesn't
  // block the row delete.
  const paths = (rows ?? []).flatMap((r) =>
    Array.isArray(r.attachments)
      ? (r.attachments as unknown as FeedbackAttachment[])
          .map((a) => a?.path)
          .filter((p): p is string => Boolean(p))
      : [],
  );
  if (paths.length > 0) {
    const { error: rmErr } = await supabase.storage.from("feedback").remove(paths);
    if (rmErr) {
      Sentry.captureMessage(`purge-feedback storage remove failed: ${rmErr.message}`, {
        level: "warning",
        tags: { cron: "purge-feedback" },
        extra: { count: paths.length },
      });
    }
  }

  const { error: delErr } = await supabase.from("app_feedback").delete().in("id", ids);
  if (delErr) {
    Sentry.captureMessage(`purge-feedback delete failed: ${delErr.message}`, {
      level: "error",
      tags: { cron: "purge-feedback" },
      extra: { ids: ids.length },
    });
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    purged: ids.length,
    files: paths.length,
    timestamp: new Date().toISOString(),
  });
}
