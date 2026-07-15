/**
 * GET /api/calls/[id]/recording
 *
 * Authenticated playback proxy (calling suite Phase 2): raw Twilio recording
 * URLs are never exposed to the browser. The signed-in user's session gates
 * access (user-context client + RLS reads the calls row); the media itself is
 * fetched server-side with the Twilio account credentials and streamed back.
 * Range headers pass through so <audio> scrubbing works.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const { data } = await sb
    .from("calls")
    .select("recording_url, recording_status")
    .eq("id", id)
    .maybeSingle();
  const call = data as { recording_url: string | null; recording_status: string | null } | null;
  if (!call?.recording_url) return new Response("no recording", { status: 404 });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return new Response("not configured", { status: 503 });

  try {
    const headers: Record<string, string> = {
      Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
    };
    const range = req.headers.get("range");
    if (range) headers.Range = range;

    // Twilio serves mp3 when .mp3 is appended to the media URL.
    const media = await fetch(`${call.recording_url}.mp3`, { headers });
    if (!media.ok || !media.body) {
      return new Response("recording unavailable", { status: 502 });
    }

    const out = new Headers();
    out.set("Content-Type", media.headers.get("content-type") ?? "audio/mpeg");
    for (const h of ["content-length", "content-range", "accept-ranges"]) {
      const v = media.headers.get(h);
      if (v) out.set(h, v);
    }
    out.set("Cache-Control", "private, max-age=3600");
    return new Response(media.body, { status: media.status, headers: out });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: "calls", route: "recording-proxy" },
      extra: { callId: id },
    });
    return new Response("recording fetch failed", { status: 502 });
  }
}
