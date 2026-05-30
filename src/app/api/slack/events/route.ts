import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

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

// ─── Slack reply helper ───────────────────────────────────────────────────────

async function postToSlack(
  channelId: string,
  text: string,
  threadTs?: string,
): Promise<void> {
  const botToken = process.env.SLACK_BOT_TOKEN ?? "";
  if (!botToken || !channelId) {
    console.error("[slack/events] postToSlack: missing token or channel", {
      hasToken: !!botToken,
      channelId,
    });
    return;
  }
  try {
    const body: Record<string, unknown> = { channel: channelId, text };
    if (threadTs) body.thread_ts = threadTs;
    const resp = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await resp.json()) as { ok: boolean; error?: string };
    if (!json.ok) console.error("[slack/events] chat.postMessage error:", json.error);
  } catch (err) {
    console.error("[slack/events] postToSlack threw:", err);
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  // Parse first so url_verification works before signature check
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (body.type === "url_verification") {
    return Response.json({ challenge: body.challenge });
  }

  // Signature check on real events
  const slackSignature = request.headers.get("x-slack-signature")         ?? "";
  const slackTimestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signingSecret  = process.env.SLACK_SIGNING_SECRET ?? "";

  if (
    !signingSecret ||
    !verifySlackSignature(signingSecret, rawBody, slackTimestamp, slackSignature)
  ) {
    console.error("[slack/events] Invalid signature");
    return new Response("Unauthorized", { status: 401 });
  }

  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return Response.json({ ok: true });

  // Debug log every event we receive (visible in Vercel logs)
  console.log("[slack/events] event received", {
    type: event.type,
    subtype: event.subtype,
    channel: event.channel,
    hasFiles: Array.isArray(event.files) && (event.files as unknown[]).length > 0,
    user: event.user,
    bot_id: event.bot_id,
  });

  const isMessage = event.type === "message";
  const files = event.files as Array<Record<string, unknown>> | undefined;
  const hasFiles = Array.isArray(files) && files.length > 0;
  const channelId = process.env.SLACK_INVOICE_CHANNEL_ID;
  const inChannel = event.channel === channelId;
  const isBotMessage = !!event.bot_id; // ignore the bot's own replies

  if (isBotMessage || !isMessage || !hasFiles || !inChannel) {
    if (!isBotMessage && hasFiles && !inChannel) {
      console.log(
        `[slack/events] file in wrong channel: got=${event.channel} expected=${channelId}`,
      );
    }
    return Response.json({ ok: true });
  }

  // Process each file with full error-to-Slack reporting
  for (const file of files!) {
    try {
      await processSlackFile(file, event);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[slack/events] Error processing file:", err);
      await postToSlack(
        channelId!,
        `⚠️ I tried to process that file but hit an error: \`${msg}\`. Check Vercel logs.`,
        event.ts as string | undefined,
      );
    }
  }

  return Response.json({ ok: true });
}

// ─── File processing ──────────────────────────────────────────────────────────

async function processSlackFile(
  file: Record<string, unknown>,
  event: Record<string, unknown>,
): Promise<void> {
  const botToken = process.env.SLACK_BOT_TOKEN ?? "";
  const channelId = process.env.SLACK_INVOICE_CHANNEL_ID ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";
  const threadTs = event.ts as string | undefined;

  const fileUrl = file.url_private as string;
  const fileName = (file.name as string | undefined) ?? `invoice-${Date.now()}`;
  const mimeType = (file.mimetype as string | undefined) ?? "application/octet-stream";

  console.log("[slack/events] processing file", { fileName, mimeType });

  // Only handle images / PDFs
  if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
    await postToSlack(
      channelId,
      `Skipped \`${fileName}\` — only images and PDFs are processed as invoices.`,
      threadTs,
    );
    return;
  }

  // 1. Download from Slack
  const fileResp = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${botToken}` },
  });
  if (!fileResp.ok) {
    throw new Error(`Slack file download failed: HTTP ${fileResp.status}`);
  }
  const fileBuffer = await fileResp.arrayBuffer();

  // 2. Upload to Supabase Storage (service-role client bypasses RLS —
  //    Slack webhook has no user session so we use the service key)
  const supabase = createServiceClient();
  const storagePath = `slack/${Date.now()}-${fileName}`;

  const { error: uploadErr } = await supabase.storage
    .from("invoices")
    .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });

  if (uploadErr) {
    throw new Error(`Supabase Storage upload failed: ${uploadErr.message}`);
  }

  const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
    .from("invoices")
    .createSignedUrl(storagePath, 60 * 60 * 24);

  if (signedUrlErr || !signedUrlData?.signedUrl) {
    throw new Error(`Signed URL generation failed: ${signedUrlErr?.message ?? "no url"}`);
  }
  const signedUrl = signedUrlData.signedUrl;

  // 3. (OCR/extraction intentionally disabled — too inaccurate. Office reviews
  //     the attached file and enters vendor/amount/etc. manually in the UI.)

  // 4. Resolve submitter — try by Slack email, then fall back to first admin
  const slackUserId = event.user as string | undefined;
  let submittedById: string | null = null;
  let resolvedNote: string | null = null;

  if (slackUserId) {
    try {
      const userInfoResp = await fetch(
        `https://slack.com/api/users.info?user=${slackUserId}`,
        { headers: { Authorization: `Bearer ${botToken}` } },
      );
      const userInfo = (await userInfoResp.json()) as {
        ok: boolean;
        error?: string;
        user?: { profile?: { email?: string } };
      };

      if (userInfo.ok && userInfo.user?.profile?.email) {
        const email = userInfo.user.profile.email;
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        submittedById = profile?.id ?? null;
        if (!submittedById) {
          resolvedNote = `Slack email \`${email}\` doesn't match a TexasTurf OS profile — invoice was filed under the default submitter.`;
        }
      } else {
        resolvedNote = `Slack \`users.info\` returned no email (${userInfo.error ?? "ok=false"}). Invoice filed under default submitter.`;
      }
    } catch (err) {
      resolvedNote = `Couldn't reach Slack \`users.info\`: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Fallback: use first admin profile so the invoice can still be created
  if (!submittedById) {
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    submittedById = adminProfile?.id ?? null;
  }

  if (!submittedById) {
    throw new Error(
      "No submitter could be resolved (Slack email didn't match a profile and no admin profile exists)",
    );
  }

  // 5. Create invoice — barebones record, all detail fields entered by office in the review UI
  const now = new Date();
  const title = `Slack Upload — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const { data: invoice, error: insertErr } = await supabase
    .from("invoices")
    .insert({
      title,
      vendor_id:            null,
      submitted_by_id:      submittedById,
      status:               "awaiting_review",
      original_file_url:    signedUrl,
      original_file_type:   mimeType,
      original_file_name:   fileName,
      submitted_at:         now.toISOString(),
      status_changed_at:    now.toISOString(),
    } as unknown as import("@/lib/database.types").InvoiceInsert)
    .select()
    .single();

  if (insertErr || !invoice) {
    throw new Error(`Invoice insert failed: ${insertErr?.message ?? "no row returned"}`);
  }

  // 6. Post success back to Slack
  const successText =
    `✅ *Invoice received!*\n` +
    `<${appUrl}/invoices/${invoice.id}|Open invoice to enter details →>\n` +
    `_Status: Awaiting review_` +
    (resolvedNote ? `\n_${resolvedNote}_` : "");

  await postToSlack(channelId, successText, threadTs);
}
