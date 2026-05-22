import { NextResponse } from "next/server";
import { generateDueTasks } from "@/app/(app)/tasks/recurring/actions";

// Vercel Cron: runs daily at 6 AM UTC
// Add to vercel.json: { "crons": [{ "path": "/api/cron/recurring", "schedule": "0 6 * * *" }] }
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Verify the request comes from Vercel Cron or an authorized caller
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await generateDueTasks();

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    generated: result.generated,
    timestamp: new Date().toISOString(),
  });
}
