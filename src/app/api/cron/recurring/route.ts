import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateDueTasks } from "@/app/(app)/tasks/recurring/actions";

// Vercel Cron: runs daily at 6 AM UTC
// Add to vercel.json: { "crons": [{ "path": "/api/cron/recurring", "schedule": "0 6 * * *" }] }
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

export async function GET(request: Request) {
  // Verify the request comes from Vercel Cron or an authorized caller.
  // Fail closed: if CRON_SECRET is unset or the header doesn't match, return 401.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || !constantTimeBearerEqual(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await generateDueTasks();

  if (result.error) {
    Sentry.captureMessage(`recurring cron failed: ${result.error}`, {
      level: "error",
      tags: { cron: "recurring" },
      extra: { generated: result.generated },
    });
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    generated: result.generated,
    timestamp: new Date().toISOString(),
  });
}
