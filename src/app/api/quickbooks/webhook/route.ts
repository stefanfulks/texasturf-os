/**
 * Intuit "Event Notifications" webhook receiver.
 *
 * Verify the body against the verifier token from the Intuit app's Webhooks
 * page before trusting any payload: the body is HMAC-SHA256'd and the result
 * base64-encoded in the `intuit-signature` header.
 *
 * On a valid Invoice/Payment or Bill/BillPayment event we re-run the matching
 * AR/AP sync (idempotent) so aging stays live between the daily cron runs.
 * Always return 200 to Intuit so they don't retry-storm us — the daily cron
 * is the safety net for anything missed.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { syncArInvoices } from "@/lib/integrations/quickbooks/sync/ar";
import { syncApBills } from "@/lib/integrations/quickbooks/sync/ap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type WebhookPayload = {
  eventNotifications?: Array<{
    realmId?: string;
    dataChangeEvent?: { entities?: Array<{ name?: string }> };
  }>;
};

export async function POST(req: NextRequest) {
  const secret = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
  const sig = req.headers.get("intuit-signature");
  const body = await req.text();

  let valid = false;
  if (secret && sig) {
    const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("base64"));
    const given = Buffer.from(sig);
    valid = expected.length === given.length && timingSafeEqual(expected, given);
  }
  if (!valid) {
    // Unsigned/mis-signed payloads are dropped, not processed.
    return NextResponse.json({ ok: true, signature_valid: false });
  }

  let payload: WebhookPayload = {};
  try {
    payload = JSON.parse(body) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: true, signature_valid: true, note: "unparseable body" });
  }

  for (const notification of payload.eventNotifications ?? []) {
    const realmId = notification.realmId;
    if (!realmId) continue;
    const entities = new Set(
      (notification.dataChangeEvent?.entities ?? []).map((e) => e.name ?? ""),
    );
    try {
      if (entities.has("Invoice") || entities.has("Payment")) {
        await syncArInvoices(realmId);
      }
      if (entities.has("Bill") || entities.has("BillPayment")) {
        await syncApBills(realmId);
      }
    } catch (err) {
      // Sync writers already logged to fin_sync_log; don't 500 at Intuit.
      Sentry.captureException(err, { tags: { sync: "quickbooks", entity: "webhook" } });
    }
  }

  return NextResponse.json({ ok: true, signature_valid: true });
}
