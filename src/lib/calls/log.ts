import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import type { CallRowInsert } from "@/lib/db-helpers.types";

/**
 * The `calls` table is the recording/AI anchor (calling suite Phase 2): one
 * row per placed call, both brands, written at dial time by the dialer's
 * placeCall AND the deal-page startCall. Recording + duration land later via
 * the Twilio webhooks (matched on twilio_call_sid); Phase 3 hangs the
 * transcript + AI review off the same row.
 */
export async function logCallStart(row: CallRowInsert): Promise<void> {
  try {
    const sb = await createClient();
    const { error } = await sb.from("calls").insert(row);
    if (error) throw error;
  } catch (err) {
    // Never block the call itself on logging.
    Sentry.captureException(err, {
      tags: { feature: "calls", action: "logCallStart" },
      extra: { twilioCallSid: row.twilio_call_sid },
    });
  }
}
