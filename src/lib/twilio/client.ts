/**
 * Server-only Twilio factory + config guards.
 *
 * Credentials live in env (AGENTS.md §3) and are NEVER read on the client —
 * import this only from server actions / route handlers. When any required
 * var is missing the factory returns `null` and callers render a disabled
 * state instead of crashing (spec: "the app never crashes").
 *
 * Two capability gates, because calling and SMS light up at different times:
 *   - isTwilioConfigured() → calling is ready (account + token + number).
 *   - isSmsConfigured()    → SMS is ready (the above + a 10DLC messaging
 *                            service). SMS stays dark until 10DLC clears.
 *
 * Server-only by construction: every secret here is a non-`NEXT_PUBLIC_` env
 * var, so it reads as `undefined` in the browser bundle, and the only importers
 * are 'use server' actions + route handlers. Keep it that way — never import
 * this from a "use client" component.
 */

import twilio from "twilio";
import type { Twilio } from "twilio";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

/** Calling is ready: account SID + auth token + a purchased number. */
export function isTwilioConfigured(): boolean {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && PHONE_NUMBER);
}

/** SMS is ready: everything calling needs, plus a 10DLC messaging service. */
export function isSmsConfigured(): boolean {
  return isTwilioConfigured() && Boolean(MESSAGING_SERVICE_SID);
}

/**
 * A configured Twilio REST client, or `null` when any credential is missing.
 * Callers MUST guard on null (do not throw — unconfigured is a normal state
 * in dev/preview and pre-launch prod).
 */
export function twilioClient(): Twilio | null {
  if (!ACCOUNT_SID || !AUTH_TOKEN) return null;
  return twilio(ACCOUNT_SID, AUTH_TOKEN);
}

/** The TexasTurf caller-ID / sender number (E.164), or null when unset. */
export function twilioPhoneNumber(): string | null {
  return PHONE_NUMBER ?? null;
}

/** The 10DLC messaging service SID, or null until SMS is registered. */
export function twilioMessagingServiceSid(): string | null {
  return MESSAGING_SERVICE_SID ?? null;
}

/** The Twilio auth token — server-only, for webhook signature validation. */
export function twilioAuthToken(): string | null {
  return AUTH_TOKEN ?? null;
}

/**
 * Absolute base URL for building Twilio webhook callback URLs. Twilio fetches
 * these over the public internet, so they must be fully-qualified.
 *
 * Matches the repo-wide convention (NEXT_PUBLIC_APP_URL with the prod host as
 * fallback) used by src/lib/integrations/* and the Slack/Jobber routes — NOT
 * VERCEL_URL, which lacks a scheme and points at per-deployment URLs Twilio
 * can't reuse for the configured webhook. Trailing slash trimmed so callers
 * can append `/api/twilio/...` cleanly.
 */
export function publicBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";
  return url.replace(/\/+$/, "");
}

/** Build an absolute URL for a Twilio webhook path (e.g. "/api/twilio/voice-twiml"). */
export function twilioWebhookUrl(path: string): string {
  const base = publicBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Slack channel id (e.g. "C012ABCD") for the sales-comms fan-out — inbound
 * SMS replies, voicemails, and answered inbound calls all post here. Returns
 * null when the env var `SLACK_SALES_CHANNEL_ID` is unset, in which case
 * callers must skip Slack gracefully (in-app notifications still fire).
 *
 * Stefan-side setup: in Slack, view the #sales-comms channel details → copy
 * the `C…` id, then `printf '%s' 'Cxxxx' | vercel env add SLACK_SALES_CHANNEL_ID production`.
 */
export function slackSalesChannelId(): string | null {
  const v = process.env.SLACK_SALES_CHANNEL_ID?.trim();
  return v && v.length > 0 ? v : null;
}
