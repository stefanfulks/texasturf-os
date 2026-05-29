import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { runOcr } from "@/lib/ocr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── Slack signature verification ─────────────────────────────────────────────

function verifySlackSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex");
  const expected = `v0=${hmac}`;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // Read raw body for signature verification
  const rawBody = await request.text();

  // Parse body first so we can short-circuit the url_verification handshake
  // without requiring the signing secret to be configured server-side.
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // URL verification challenge — respond before signature check so Slack can
  // confirm the endpoint during initial setup. Slack only sends this once.
  if (body.type === "url_verification") {
    return Response.json({ challenge: body.challenge });
  }

  const slackSignature = request.headers.get("x-slack-signature")         ?? "";
  const slackTimestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signingSecret  = process.env.SLACK_SIGNING_SECRET ?? "";

  // Verify signature on all non-challenge requests
  if (
    !signingSecret ||
    !verifySlackSignature(signingSecret, rawBody, slackTimestamp, slackSignature)
  ) {
    console.error("[slack/events] Invalid signature");
    return new Response("Unauthorized", { status: 401 });
  }

  // Only handle message events with files
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) {
    return Response.json({ ok: true });
  }

  const isMessage   = event.type === "message";
  const files       = event.files as Array<Record<string, unknown>> | undefined;
  const hasFiles    = Array.isArray(files) && files.length > 0;
  const channelId   = process.env.SLACK_INVOICE_CHANNEL_ID;
  const inChannel   = event.channel === channelId;

  if (!isMessage || !hasFiles || !inChannel) {
    return Response.json({ ok: true });
  }

  // Process each file (usually just one)
  for (const file of files) {
    try {
      await processSlackFile(file, event);
    } catch (err) {
      console.error("[slack/events] Error processing file:", err);
    }
  }

  return Response.json({ ok: true });
}

// ─── File processing ──────────────────────────────────────────────────────────

async function processSlackFile(
  file: Record<string, unknown>,
  event: Record<string, unknown>,
): Promise<void> {
  const botToken  = process.env.SLACK_BOT_TOKEN ?? "";
  const channelId = process.env.SLACK_INVOICE_CHANNEL_ID ?? "";
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";

  // 1. Download file from Slack
  const fileUrl  = file.url_private as string;
  const fileName = (file.name as string | undefined) ?? `invoice-${Date.now()}`;
  const mimeType = (file.mimetype as string | undefined) ?? "application/octet-stream";

  const fileResp = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${botToken}` },
  });

  if (!fileResp.ok) {
    console.error("[slack/events] Failed to download file:", fileResp.status);
    return;
  }

  const fileBuffer = await fileResp.arrayBuffer();

  // 2. Upload to Supabase Storage
  const supabase = await createClient();
  const storagePath = `slack/${Date.now()}-${fileName}`;

  const { error: uploadErr } = await supabase.storage
    .from("invoices")
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadErr) {
    console.error("[slack/events] Storage upload error:", uploadErr.message);
    return;
  }

  const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
    .from("invoices")
    .createSignedUrl(storagePath, 60 * 60 * 24); // 24 hours

  if (signedUrlErr || !signedUrlData?.signedUrl) {
    console.error("[slack/events] Signed URL error:", signedUrlErr?.message);
    return;
  }

  const signedUrl = signedUrlData.signedUrl;

  // 3. Run OCR
  const ocr = await runOcr(signedUrl, mimeType);

  // 4. Look up Slack user's profile to find TexasTurf user
  const slackUserId = event.user as string | undefined;
  let submittedById: string | null = null;

  if (slackUserId) {
    try {
      const userInfoResp = await fetch(
        `https://slack.com/api/users.info?user=${slackUserId}`,
        { headers: { Authorization: `Bearer ${botToken}` } },
      );
      const userInfo = await userInfoResp.json() as {
        ok: boolean;
        user?: { profile?: { email?: string } };
      };

      if (userInfo.ok && userInfo.user?.profile?.email) {
        const email = userInfo.user.profile.email;
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .single();
        submittedById = profile?.id ?? null;
      }
    } catch (err) {
      console.error("[slack/events] Failed to resolve Slack user:", err);
    }
  }

  if (!submittedById) {
    console.warn("[slack/events] Could not resolve user — skipping invoice creation");
    return;
  }

  // 5. Create invoice
  const now = new Date();
  const title = `${ocr.vendor_name ?? "Slack Upload"} Invoice ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const { data: invoice, error: insertErr } = await (supabase
    .from("invoices")
    .insert({
      title,
      vendor_id:            null,
      submitted_by_id:      submittedById,
      status:               "ocr_review_needed",
      original_file_url:    signedUrl,
      original_file_type:   mimeType,
      original_file_name:   fileName,
      total_amount:         ocr.total_amount          ?? null,
      invoice_number:       ocr.invoice_number        ?? null,
      service_period_start: ocr.service_period_start  ?? null,
      service_period_end:   ocr.service_period_end    ?? null,
      ocr_confidence:       ocr.confidence,
      submitted_at:         now.toISOString(),
      status_changed_at:    now.toISOString(),
    } as unknown as import("@/lib/database.types").InvoiceInsert)
    .select()
    .single());

  if (insertErr || !invoice) {
    console.error("[slack/events] Invoice insert error:", insertErr?.message);
    return;
  }

  // 6. Insert line items
  if (ocr.line_items.length > 0) {
    const { error: lineItemErr } = await supabase.from("invoice_line_items").insert(
      ocr.line_items.map((item, i) => ({
        invoice_id:  invoice.id,
        description: item.description,
        quantity:    item.quantity   ?? null,
        unit_price:  item.unit_price ?? null,
        line_total:  item.line_total,
        sort_order:  i,
      })),
    );
    if (lineItemErr) {
      console.error("[slack/events] Line items insert error:", lineItemErr.message);
    }
  }

  // 7. Post back to Slack
  const amountText = ocr.total_amount != null
    ? `$${ocr.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : "Amount TBD";
  const vendorText = ocr.vendor_name ?? "Vendor TBD";

  const slackBody = {
    channel: channelId,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *Invoice received from Slack!*\n${vendorText} · ${amountText}\n<${appUrl}/invoices/${invoice.id}|Review Invoice →>`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `OCR confidence: ${ocr.confidence}% · Status: Needs Review`,
        },
      },
    ],
  };

  try {
    const postResp = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify(slackBody),
    });
    const postJson = await postResp.json() as { ok: boolean; error?: string };
    if (!postJson.ok) {
      console.error("[slack/events] chat.postMessage error:", postJson.error);
    }
  } catch (err) {
    console.error("[slack/events] Failed to post to Slack:", err);
  }
}
