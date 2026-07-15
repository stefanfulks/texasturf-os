/**
 * POST /api/twilio/recording-status
 *
 * Recording lifecycle callback for bridge/dialer calls (calling suite Phase
 * 2). The <Dial record> in voice-twiml points here; on `completed` we stamp
 * the recording sid/url/status onto the `calls` row matched by the parent
 * CallSid. Raw Twilio URLs are never served to the browser — playback goes
 * through the authenticated proxy at /api/calls/[id]/recording.
 *
 * No user session — service client. Public URL → signature validated.
 * Unconfigured → 200 no-op. Invalid/missing signature → 401 (fail closed).
 */

import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateTwilioRequest } from "@/lib/twilio/webhook";
import { processRecordingReady } from "@/lib/calls/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The after() pipeline (download → transcribe → AI review → tasks) needs more
// than the default function window.
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  const check = await validateTwilioRequest(req, "/api/twilio/recording-status");
  if (check.state === "unconfigured") return new Response("ok", { status: 200 });
  if (check.state === "invalid") {
    return new Response("invalid signature", { status: 401 });
  }

  const { params } = check;
  const callSid = params.CallSid ?? "";
  const recordingSid = params.RecordingSid ?? "";
  const recordingStatus = params.RecordingStatus ?? "";
  const recordingUrl = params.RecordingUrl ?? "";
  const recordingDuration = Number.parseInt(params.RecordingDuration ?? "0", 10) || null;

  if (!callSid || !recordingSid) return new Response("ok", { status: 200 });

  try {
    const sb = createServiceClient();
    const completed = recordingStatus === "completed" && !!recordingUrl;
    const patch = {
      recording_sid: recordingSid,
      recording_status: recordingStatus || null,
      ...(completed ? { recording_url: recordingUrl } : {}),
      ...(completed && recordingDuration ? { duration_sec: recordingDuration } : {}),
    };
    const { data, error } = await sb
      .from("calls")
      .update(patch)
      .eq("twilio_call_sid", callSid)
      .select("id");
    if (error) throw error;
    if (!data?.length) {
      // No calls row (e.g. inbound or legacy call) — nothing to attach to.
      Sentry.addBreadcrumb({
        category: "twilio",
        message: `recording-status: no calls row for ${callSid}`,
        level: "warning",
      });
    } else if (recordingStatus === "completed" && recordingUrl) {
      // Phase 3: transcribe + AI review + auto tasks, after the 200 returns
      // (Twilio's webhook timeout is far shorter than the pipeline).
      after(() => processRecordingReady(callSid));
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { webhook: "twilio", route: "recording-status" },
      extra: { callSid, recordingSid, recordingStatus },
    });
  }

  return new Response("ok", { status: 200 });
}
