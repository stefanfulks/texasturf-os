import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";

function verifySlackSignature(rawBody: string, timestamp: string, signature: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET ?? "";
  if (!secret) return false;
  const hmac = crypto.createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(`v0=${hmac}`, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}

function ephemeral(text: string) {
  return Response.json({ response_type: "ephemeral", text });
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  const ts = request.headers.get("x-slack-request-timestamp") ?? "";
  const sig = request.headers.get("x-slack-signature") ?? "";
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!verifySlackSignature(rawBody, ts, sig)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const command = params.get("command");
  const text = (params.get("text") ?? "").trim();
  const userName = params.get("user_name") ?? "Slack user";
  const channelId = params.get("channel_id") ?? null;

  if (command !== "/order") {
    return ephemeral("Unknown command.");
  }
  if (!text) {
    return ephemeral("Usage: `/order <what you need>` — e.g. `/order 3 pallets of decomposed granite`. You can set the vendor, buyer, and payment details in the app afterward.");
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("purchase_orders")
      .insert({
        status: "new_request",
        request_description: text,
        requested_by: userName,
        priority: "normal",
        purchase_type: "inventory_replenishment",
        slack_channel_id: channelId,
      })
      .select("id")
      .single();

    if (error || !data) {
      Sentry.captureMessage(`/order insert failed: ${error?.message ?? "no row"}`, { level: "error", tags: { slack: "command" } });
      return ephemeral("Couldn't create that request — try again, or use the app.");
    }

    await supabase.from("purchase_order_events").insert({
      purchase_order_id: data.id,
      event_type: "status_change",
      source: "slack",
      new_status: "new_request",
      notes: `Created from Slack by ${userName}`,
    });

    return ephemeral(
      `✅ Vendor order request created.\n<${APP_URL}/operations/vendor-orders/${data.id}|Open it> to assign a buyer and add vendor/payment details.`,
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { slack: "command" } });
    return ephemeral("Something went wrong creating the request.");
  }
}
