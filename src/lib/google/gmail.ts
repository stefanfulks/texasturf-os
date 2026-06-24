/**
 * Gmail send via the rep's own Google account.
 *
 * Direct fetch to gmail.googleapis.com (matches the calendar.ts pattern —
 * no `googleapis` package). The access token comes from
 * getValidGoogleAccessToken() in tokens.ts, which auto-refreshes when needed
 * (refresh_token lives in google_oauth_tokens, service-role gated).
 *
 * Build flow: assemble an RFC-822 message, base64url-encode it, POST to
 * /users/me/messages/send. Gmail uses the token's account as the sender;
 * the rep's "from" is automatic.
 *
 * Scope required: https://www.googleapis.com/auth/gmail.send
 * On a 403 with reason "insufficient_authorized_scopes" the rep needs to
 * sign out + sign in again so the new scope is granted (we use
 * prompt=consent so the new scope shows on re-auth).
 */

const SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

/**
 * Whether Google OAuth is configured at all (same env vars Calendar uses).
 * The per-user scope grant is enforced at send time via the typed SendError.
 */
export function isGmailConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

export interface SendOptions {
  to: string;
  fromName: string; // display name for the From header
  fromEmail: string; // the rep's Gmail address (same as the OAuth account)
  subject: string;
  body: string; // plain text; line breaks preserved
  inReplyTo?: string | null;
}

export interface SendResult {
  id: string; // Gmail message id
  threadId: string;
}

interface GmailApiError {
  error?: { code?: number; message?: string; status?: string };
}

/** Base64url per RFC 4648 — Gmail rejects standard base64 padding here. */
function base64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Escape a value for an RFC-822 header (e.g. the display name). */
function quoteHeader(value: string): string {
  // Strip CR/LF — header injection guard.
  const clean = value.replace(/[\r\n]+/g, " ").trim();
  // Quote when it contains anything outside safe atom characters.
  if (/[^A-Za-z0-9 .@_-]/.test(clean)) {
    return `"${clean.replace(/["\\]/g, "\\$&")}"`;
  }
  return clean;
}

function buildRfc822(opts: SendOptions): string {
  const from = `${quoteHeader(opts.fromName)} <${opts.fromEmail}>`;
  const headers = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject.replace(/[\r\n]+/g, " ").trim()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ];
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  return `${headers.join("\r\n")}\r\n\r\n${opts.body}`;
}

export type SendError =
  | { kind: "scope_missing"; detail: string } // need re-auth
  | { kind: "auth_failed"; detail: string }
  | { kind: "send_failed"; status: number; detail: string };

/** Send a Gmail message. Throws a SendError on failure (typed via .kind). */
export async function sendGmail(
  accessToken: string,
  opts: SendOptions,
): Promise<SendResult> {
  const raw = base64url(buildRfc822(opts));

  const resp = await fetch(SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!resp.ok) {
    let detail = "";
    let status = "";
    try {
      const j = (await resp.json()) as GmailApiError;
      detail = j.error?.message ?? "";
      status = j.error?.status ?? "";
    } catch {
      detail = await resp.text();
    }
    // 401 = bad/expired token. 403 with these statuses = scope missing.
    if (resp.status === 403 || /insufficient/i.test(status) || /insufficient/i.test(detail)) {
      throw { kind: "scope_missing", detail } as SendError;
    }
    if (resp.status === 401) {
      throw { kind: "auth_failed", detail } as SendError;
    }
    throw { kind: "send_failed", status: resp.status, detail } as SendError;
  }

  return (await resp.json()) as SendResult;
}
