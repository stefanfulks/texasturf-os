/**
 * Shared Twilio webhook helpers: signature validation + body parsing.
 *
 * All three Twilio routes are public URLs, so signature validation is
 * MANDATORY (spec §Security). Twilio signs each request with the auth token
 * over the full URL + the POSTed form params; `validateRequest` recomputes the
 * HMAC and compares. A mismatch → the route returns 403 and logs nothing.
 *
 * When `TWILIO_AUTH_TOKEN` is unset, nothing is configured — the routes no-op
 * with a 200 rather than 403 (there's no secret to validate against, and a
 * misconfigured-but-public endpoint shouldn't hard-fail Twilio's probes).
 */

import twilio from "twilio";
import { twilioAuthToken, twilioWebhookUrl } from "./client";

export type SignatureCheck =
  | { state: "ok"; params: Record<string, string> }
  | { state: "unconfigured" } // no auth token → nothing to validate
  | { state: "invalid" }; // signature present but did not match

/**
 * Read the form-encoded body, then validate the X-Twilio-Signature against the
 * canonical absolute URL for `routePath` (NOT req.url — behind Vercel's proxy
 * the inbound host/proto can differ from what Twilio signed; we rebuild the
 * URL from the same base used to register the webhook, preserving the exact
 * query string Twilio appended).
 *
 * `routePath` is the path with its leading slash, e.g. "/api/twilio/voice-status".
 */
export async function validateTwilioRequest(
  req: Request,
  routePath: string,
): Promise<SignatureCheck> {
  const authToken = twilioAuthToken();
  if (!authToken) return { state: "unconfigured" };

  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody)) as Record<
    string,
    string
  >;

  // Reconstruct the exact URL Twilio signed: configured base + path + the
  // query string from the incoming request (Twilio includes any query params
  // we put on the callback URL, e.g. ?dealId=...).
  const incoming = new URL(req.url);
  const url = twilioWebhookUrl(`${routePath}${incoming.search}`);

  const signature = req.headers.get("x-twilio-signature") ?? "";
  const valid = twilio.validateRequest(authToken, signature, url, params);

  return valid ? { state: "ok", params } : { state: "invalid" };
}

/** A `text/xml` Response for returning TwiML to Twilio. */
export function twimlResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
