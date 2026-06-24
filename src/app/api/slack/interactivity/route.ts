import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import {
  applyQuickAction, openModal, respondViaUrl,
  buildCreateModal, buildEtaModal,
  CREATE_MODAL_CALLBACK, ETA_MODAL_CALLBACK, OVERFLOW_ACTION_ID,
  type PoAction,
} from "@/lib/integrations/slack-purchasing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";
export const MESSAGE_SHORTCUT_CALLBACK = "create_vendor_order";

function verify(rawBody: string, ts: string, sig: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET ?? "";
  if (!secret) return false;
  const hmac = crypto.createHmac("sha256", secret).update(`v0:${ts}:${rawBody}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(`v0=${hmac}`, "utf8"), Buffer.from(sig, "utf8"));
  } catch {
    return false;
  }
}

type AnyObj = Record<string, unknown>;
function obj(v: unknown): AnyObj { return (v && typeof v === "object" ? v : {}) as AnyObj; }
function str(v: unknown): string { return typeof v === "string" ? v : ""; }

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const ts = request.headers.get("x-slack-request-timestamp") ?? "";
  const sig = request.headers.get("x-slack-signature") ?? "";

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!verify(rawBody, ts, sig)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: AnyObj;
  try {
    payload = JSON.parse(new URLSearchParams(rawBody).get("payload") ?? "{}") as AnyObj;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const type = str(payload.type);
  const user = obj(payload.user);
  const byNote = str(user.username) || str(user.name) || "Slack";

  try {
    // ── Message shortcut: "Create Vendor Order" from a #low-inventory message ──
    if ((type === "message_action" || type === "shortcut") && str(payload.callback_id) === MESSAGE_SHORTCUT_CALLBACK) {
      const prefill = str(obj(payload.message).text);
      await openModal(str(payload.trigger_id), buildCreateModal(prefill));
      return new Response(null, { status: 200 });
    }

    // ── Overflow quick-actions on digest lines ────────────────────────────────
    if (type === "block_actions") {
      const actions = Array.isArray(payload.actions) ? (payload.actions as AnyObj[]) : [];
      const action = actions[0] ?? {};
      if (str(action.action_id) === OVERFLOW_ACTION_ID) {
        const value = str(obj(action.selected_option).value); // "action:orderId"
        const [act, orderId] = value.split(":");
        const responseUrl = str(payload.response_url);

        if (act === "update_eta") {
          await openModal(str(payload.trigger_id), buildEtaModal(orderId));
          return new Response(null, { status: 200 });
        }

        const service = createServiceClient();
        const confirm = await applyQuickAction(service, orderId, act as PoAction, byNote);
        if (responseUrl) {
          await respondViaUrl(responseUrl, confirm ? `${confirm} <${APP_URL}/operations/vendor-orders/${orderId}|View>` : "That order no longer exists.");
        }
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 200 });
    }

    // ── Modal submissions ─────────────────────────────────────────────────────
    if (type === "view_submission") {
      const view = obj(payload.view);
      const callback = str(view.callback_id);
      const values = obj(obj(view.state).values);

      if (callback === ETA_MODAL_CALLBACK) {
        const orderId = str(view.private_metadata);
        const eta = str(obj(obj(obj(values).eta).v).selected_date);
        const service = createServiceClient();
        await applyQuickAction(service, orderId, "update_eta", byNote, eta);
        return Response.json({ response_action: "clear" });
      }

      if (callback === CREATE_MODAL_CALLBACK) {
        const get = (block: string) => obj(obj(values)[block]).v;
        const description = str(obj(get("desc")).value).trim();
        const material = str(obj(get("material")).value).trim();
        const qty = str(obj(get("qty")).value).trim();
        const priority = str(obj(obj(get("priority")).selected_option).value) || "normal";

        if (!description) {
          return Response.json({ response_action: "errors", errors: { desc: "Tell us what you need." } });
        }

        const service = createServiceClient();
        const { data, error } = await service
          .from("purchase_orders")
          .insert({
            status: "new_request",
            request_description: description,
            material_needed: material || null,
            quantity_needed: qty || null,
            priority: priority as "low" | "normal" | "high" | "urgent",
            requested_by: byNote,
            purchase_type: "inventory_replenishment",
          })
          .select("id")
          .single();

        if (error || !data) {
          Sentry.captureMessage(`po_create modal insert failed: ${error?.message ?? "no row"}`, { level: "error", tags: { slack: "interactivity" } });
          return Response.json({ response_action: "errors", errors: { desc: "Couldn't save — try again." } });
        }

        await service.from("purchase_order_events").insert({
          purchase_order_id: data.id,
          event_type: "status_change",
          source: "slack",
          new_status: "new_request",
          notes: `Created from Slack by ${byNote}`,
        });
        return Response.json({ response_action: "clear" });
      }
    }

    return new Response(null, { status: 200 });
  } catch (err) {
    Sentry.captureException(err, { tags: { slack: "interactivity" } });
    return new Response(null, { status: 200 }); // ack so Slack doesn't retry-storm
  }
}
