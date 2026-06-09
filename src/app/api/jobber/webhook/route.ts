/**
 * POST /api/jobber/webhook
 *
 * Jobber requires us to ack inside 1 second. We do the minimum here:
 *   1. verify HMAC
 *   2. persist the raw event for audit
 *   3. fire-and-forget the per-topic handler (don't await)
 *   4. return 200 immediately
 *
 * Handlers update / delete the local mirror tables. Errors are persisted
 * back onto the audit row so we can re-process or investigate later.
 *
 * NOTE: This is a public endpoint. The HMAC verification is what keeps
 * non-Jobber callers from forging events.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncClient } from "@/lib/jobber/sync/clients";
import { syncVisit }  from "@/lib/jobber/sync/visits";
import { syncJob }    from "@/lib/jobber/sync/jobs";

export async function POST(req: NextRequest) {
  const raw       = await req.text();
  const signature = req.headers.get("x-jobber-hmac-sha256") ?? "";

  // Require JOBBER_WEBHOOK_SECRET explicitly. The previous fallback to
  // JOBBER_CLIENT_SECRET kinda-worked (Jobber's webhook secret IS the app
  // secret in their default setup) but masked misconfigurations — if the
  // webhook secret was rotated separately, everything silently 401'd.
  const secret = process.env.JOBBER_WEBHOOK_SECRET ?? "";
  if (!secret) {
    Sentry.captureMessage("JOBBER_WEBHOOK_SECRET unset — webhook rejected", {
      level: "error",
      tags: { webhook: "jobber" },
    });
    return new NextResponse("server misconfigured", { status: 503 });
  }

  const hmacValid = verify(raw, signature, secret);

  let parsed: WebhookPayload | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Unparseable body — we still log the row for forensics.
  }

  const topic      = parsed?.data?.webHookEvent?.topic     ?? "UNKNOWN";
  const itemId     = parsed?.data?.webHookEvent?.itemId    ?? null;
  const accountId  = parsed?.data?.webHookEvent?.accountId ?? null;
  const occuredAt  = parsed?.data?.webHookEvent?.occuredAt ?? null;

  const supa = supabaseAdmin();

  // Idempotency: UNIQUE(topic, item_id, occured_at). If Jobber retries the
  // same event we want to ack 200 but NOT re-run dispatch (re-running
  // burns Jobber sync cost + duplicate Sentry events).
  const { data: inserted } = await supa
    .from("jobber_webhook_events")
    .upsert(
      {
        jobber_account_id: accountId,
        topic,
        item_id:           itemId,
        occured_at:        occuredAt,
        hmac_valid:        hmacValid,
        raw:               parsed ?? { unparsed: raw },
      },
      { onConflict: "topic,item_id,occured_at", ignoreDuplicates: true },
    )
    .select("id");

  const isDuplicate = !inserted || inserted.length === 0;

  if (!hmacValid) return new NextResponse("invalid signature", { status: 401 });

  if (isDuplicate) {
    // Already processed (or in-flight from an earlier delivery); ack only.
    return new NextResponse("ok", { status: 200 });
  }

  if (accountId && itemId) {
    void dispatch(topic, accountId, itemId).catch((err) => {
      console.error(`webhook handler error (${topic} ${itemId})`, err);
      Sentry.captureException(err, {
        tags: { webhook: "jobber", topic },
        extra: { topic, itemId, accountId },
      });
    });
  }

  return new NextResponse("ok", { status: 200 });
}

type WebhookPayload = {
  data?: {
    webHookEvent?: {
      topic?:     string;
      accountId?: string;
      itemId?:    string;
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
  const supa = supabaseAdmin();
  try {
    if (topic.startsWith("CLIENT_")) {
      if (topic === "CLIENT_DESTROY") {
        await supa.from("jobber_clients").delete().eq("id", itemId);
      } else {
        await syncClient(accountId, itemId);
      }
    } else if (topic.startsWith("VISIT_")) {
      if (topic === "VISIT_DESTROY") {
        await supa.from("jobber_visits").delete().eq("id", itemId);
      } else {
        await syncVisit(accountId, itemId);
      }
    } else if (topic.startsWith("JOB_")) {
      if (topic === "JOB_DESTROY") {
        await supa.from("jobber_jobs").delete().eq("id", itemId);
      } else {
        await syncJob(accountId, itemId);
      }
    }
    await supa
      .from("jobber_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("topic", topic)
      .eq("item_id", itemId)
      .is("processed_at", null);
  } catch (err) {
    await supa
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
