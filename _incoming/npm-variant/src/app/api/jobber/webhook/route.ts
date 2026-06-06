import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { syncClient } from "@/lib/jobber/sync/clients";
import { syncVisit } from "@/lib/jobber/sync/visits";

// Jobber requires ack within 1 second. Do the minimum here:
// verify HMAC, persist the raw event, fire-and-forget per-topic handler.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-jobber-hmac-sha256") ?? "";
  const secret = process.env.JOBBER_WEBHOOK_SECRET ?? process.env.JOBBER_CLIENT_SECRET ?? "";

  const hmacValid = verify(raw, signature, secret);

  let parsed: WebhookPayload | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // fall through; we still log the row
  }

  const topic = parsed?.data?.webHookEvent?.topic ?? "UNKNOWN";
  const itemId = parsed?.data?.webHookEvent?.itemId ?? null;
  const accountId = parsed?.data?.webHookEvent?.accountId ?? null;

  const sb = supabaseAdmin();
  await sb.from("jobber_webhook_events").insert({
    jobber_account_id: accountId,
    topic,
    item_id: itemId,
    hmac_valid: hmacValid,
    raw: parsed ?? { unparsed: raw },
  });

  if (!hmacValid) return new NextResponse("invalid signature", { status: 401 });

  // Dispatch to topic handlers without awaiting — return 200 immediately.
  if (accountId && itemId) {
    void dispatch(topic, accountId, itemId).catch((err) =>
      console.error(`webhook handler error (${topic} ${itemId})`, err),
    );
  }

  return new NextResponse("ok", { status: 200 });
}

type WebhookPayload = {
  data?: {
    webHookEvent?: {
      topic?: string;
      accountId?: string;
      itemId?: string;
      occuredAt?: string;
    };
  };
};

function verify(body: string, headerSig: string, secret: string): boolean {
  if (!headerSig || !secret) return false;
  const expected = createHmac("sha256", secret).update(body).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(headerSig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function dispatch(topic: string, accountId: string, itemId: string) {
  const sb = supabaseAdmin();
  try {
    if (topic.startsWith("CLIENT_")) {
      if (topic === "CLIENT_DESTROY") {
        await sb.from("jobber_clients").delete().eq("id", itemId);
      } else {
        await syncClient(accountId, itemId);
      }
    } else if (topic.startsWith("VISIT_")) {
      if (topic === "VISIT_DESTROY") {
        await sb.from("jobber_visits").delete().eq("id", itemId);
      } else {
        await syncVisit(accountId, itemId);
      }
    }
    await sb
      .from("jobber_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("topic", topic)
      .eq("item_id", itemId)
      .is("processed_at", null);
  } catch (err) {
    await sb
      .from("jobber_webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        process_error: err instanceof Error ? err.message : String(err),
      })
      .eq("topic", topic)
      .eq("item_id", itemId)
      .is("processed_at", null);
    throw err;
  }
}
