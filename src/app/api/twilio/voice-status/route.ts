/**
 * POST /api/twilio/voice-status?dealId=<uuid>&direction=outbound|inbound
 *
 * Twilio's call status callback (statusCallbackEvent=['completed']). On a
 * completed call we log a `deal_activities` row with the duration + status in
 * metadata, so the call shows on the deal timeline.
 *
 * Direction is taken from the query string (defaults to 'outbound' for
 * backward compatibility with calls placed by /lib/.../comms-actions). Inbound
 * answered calls (Number statusCallback from voice-inbound) additionally fire
 * the inbound notification fan-out (owner in-app + Slack).
 *
 * No user session — service client. Public URL → signature validated.
 * Unconfigured → 200 no-op. Invalid signature → 403.
 */

import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { validateTwilioRequest } from "@/lib/twilio/webhook";
import { notifyInboundActivity } from "@/lib/twilio/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "0s";
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export async function POST(req: Request): Promise<Response> {
  const check = await validateTwilioRequest(req, "/api/twilio/voice-status");
  if (check.state === "unconfigured") return new Response("ok", { status: 200 });
  if (check.state === "invalid") return new Response("invalid signature", { status: 403 });

  const { params } = check;
  const url = new URL(req.url);
  const dealId = url.searchParams.get("dealId");
  const direction = url.searchParams.get("direction") === "inbound" ? "inbound" : "outbound";
  const status = params.CallStatus ?? "";

  if (status !== "completed" || !dealId) return new Response("ok", { status: 200 });

  const durationSec = Number.parseInt(params.CallDuration ?? "0", 10) || 0;
  const callSid = params.CallSid ?? null;

  try {
    const sb = createServiceClient();
    await sb.from("deal_activities").insert({
      deal_id: dealId,
      kind: "call",
      direction,
      body: `Call — ${formatDuration(durationSec)} (${status})`,
      metadata: { callSid, durationSec, status },
    });

    // For inbound answered calls, fan out to owner + Slack — same surface
    // SMS replies and voicemails use. Owner lookup happens here (the
    // statusCallback doesn't carry contact info, just dealId + Twilio sids).
    if (direction === "inbound") {
      const { data: deal } = await sb
        .from("deals")
        .select("id, name, owner_id, sales_contact_id")
        .eq("id", dealId)
        .maybeSingle();
      const dealRow = deal as { id: string; name: string; owner_id: string | null; sales_contact_id: string | null } | null;

      let contactName: string | null = null;
      if (dealRow?.sales_contact_id) {
        const { data: c } = await sb.from("sales_contacts").select("name").eq("id", dealRow.sales_contact_id).maybeSingle();
        contactName = (c as { name: string } | null)?.name ?? null;
      }

      if (dealRow) {
        await notifyInboundActivity(sb, {
          // Reuse the "voicemail" label for answered inbound — both are "they
          // reached out". Distinct enum branch is a future polish item.
          kind: "voicemail",
          ownerId: dealRow.owner_id,
          dealId: dealRow.id,
          dealName: dealRow.name,
          contactName,
          summary: `Answered call — ${formatDuration(durationSec)}`,
        });
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { webhook: "twilio", route: "voice-status" },
      extra: { dealId, callSid, status, direction },
    });
  }

  return new Response("ok", { status: 200 });
}
