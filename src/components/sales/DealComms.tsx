"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageSquare, Mail, Send } from "lucide-react";
import type { DealActivity } from "@/lib/sales/types";
import { shortDate } from "@/lib/sales/format";
import {
  startCall,
  sendSms,
  sendEmailFromDeal,
  type CommResult,
} from "@/app/(app)/sales/comms-actions";

/**
 * Call button + SMS thread/composer for the deal page. Client-side because it
 * drives the comms server actions; capability flags are computed server-side
 * (env stays server-only) and passed in as props.
 *
 * Disabled states are first-class (the expected pre-launch state):
 *   - no phone        → both surfaces show "add a phone number".
 *   - !twilioConfigured → Call button disabled with a tooltip.
 *   - !smsConfigured    → composer disabled with the 10DLC note.
 */
export function DealComms({
  dealId,
  contactId,
  contactPhone,
  contactEmail,
  smsActivities,
  emailActivities,
  twilioConfigured,
  smsConfigured,
  gmailConfigured,
}: {
  dealId: string;
  contactId: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  smsActivities: DealActivity[];
  emailActivities: DealActivity[];
  twilioConfigured: boolean;
  smsConfigured: boolean;
  gmailConfigured: boolean;
}) {
  const router = useRouter();
  const hasPhone = Boolean(contactPhone?.trim()) && Boolean(contactId);
  const hasEmail = Boolean(contactEmail?.trim()) && Boolean(contactId);

  const [calling, startCalling] = useTransition();
  const [callResult, setCallResult] = useState<CommResult | null>(null);

  const [draft, setDraft] = useState("");
  const [texting, startTexting] = useTransition();
  const [smsResult, setSmsResult] = useState<CommResult | null>(null);

  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailing, startEmailing] = useTransition();
  const [emailResult, setEmailResult] = useState<CommResult | null>(null);

  function placeCall() {
    if (!contactId) return;
    setCallResult(null);
    startCalling(async () => {
      const result = await startCall(dealId, contactId);
      setCallResult(result);
      if (result.ok) router.refresh();
    });
  }

  function text() {
    const message = draft.trim();
    if (!message || !contactId) return;
    setSmsResult(null);
    startTexting(async () => {
      const result = await sendSms(dealId, contactId, message);
      setSmsResult(result);
      if (result.ok) {
        setDraft("");
        router.refresh();
      }
    });
  }

  const thread = [...smsActivities].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at),
  );

  function sendEmail() {
    const subj = subject.trim();
    const body = emailBody.trim();
    if (!subj || !body || !contactId) return;
    setEmailResult(null);
    startEmailing(async () => {
      const result = await sendEmailFromDeal(dealId, contactId, subj, body);
      setEmailResult(result);
      if (result.ok) {
        setSubject("");
        setEmailBody("");
        router.refresh();
      }
    });
  }

  const emailThread = [...emailActivities].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );

  return (
    <div className="card px-4 py-3.5">
      <div className="eyebrow mb-2.5 flex items-center gap-1.5">
        <Phone className="size-3.5" strokeWidth={2.2} />
        Contact
      </div>

      {!hasPhone ? (
        <p className="text-[12.5px] text-ink-3">
          Add a phone number to this contact to call or text.
        </p>
      ) : (
        <>
          {/* Phone + Call button */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[13px] tabular-nums text-ink">
              {contactPhone}
            </span>
            <span
              title={
                twilioConfigured ? undefined : "Twilio not set up yet"
              }
              className="shrink-0"
            >
              <button
                onClick={placeCall}
                disabled={!twilioConfigured || calling}
                className="btn btn-primary btn-sm"
              >
                <Phone className="size-3.5" strokeWidth={2.2} />
                {calling ? "Calling…" : "Call"}
              </button>
            </span>
          </div>

          {callResult ? (
            <p
              className={`mb-3 text-[12px] ${
                callResult.ok ? "text-brand" : "text-danger"
              }`}
            >
              {callResult.ok
                ? "Calling — your phone will ring, then we'll connect the lead."
                : callResult.reason}
            </p>
          ) : null}

          {/* SMS thread + composer */}
          <div className="mt-1 border-t border-line pt-3">
            <div className="eyebrow mb-2 flex items-center gap-1.5">
              <MessageSquare className="size-3.5" strokeWidth={2.2} />
              Text
            </div>

            {thread.length ? (
              <ul className="mb-3 space-y-1.5">
                {thread.map((m) => {
                  const outbound = m.direction === "outbound";
                  return (
                    <li
                      key={m.id}
                      className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[12.5px] leading-snug ${
                          outbound
                            ? "bg-brand-tint text-ink"
                            : "border border-line bg-surface text-ink-2"
                        }`}
                      >
                        <div>{m.body}</div>
                        <div className="eyebrow mt-0.5 text-[9px] text-ink-4">
                          {outbound ? "Sent" : "Received"} ·{" "}
                          {shortDate(m.occurred_at)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mb-3 text-[12px] text-ink-3">No texts yet.</p>
            )}

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              disabled={!smsConfigured || texting}
              placeholder={
                smsConfigured
                  ? "Type a text to the lead…"
                  : "Texting goes live when 10DLC is approved."
              }
              className="field-input"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              {!smsConfigured ? (
                <span className="text-[11px] text-ink-4">
                  Texting goes live when 10DLC is approved.
                </span>
              ) : smsResult && !smsResult.ok ? (
                <span className="text-[11px] text-danger">
                  {smsResult.reason}
                </span>
              ) : (
                <span />
              )}
              <button
                onClick={text}
                disabled={!smsConfigured || !draft.trim() || texting}
                className="btn btn-primary btn-sm shrink-0"
              >
                <Send className="size-3.5" strokeWidth={2.2} />
                {texting ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Email composer (sends from the signed-in rep's Gmail) */}
      <div className="mt-3 border-t border-line pt-3">
        <div className="eyebrow mb-2 flex items-center gap-1.5">
          <Mail className="size-3.5" strokeWidth={2.2} />
          Email
          {contactEmail ? (
            <span className="ml-1 truncate text-[11px] font-normal text-ink-4">
              · to {contactEmail}
            </span>
          ) : null}
        </div>

        {emailThread.length ? (
          <ul className="mb-3 space-y-1.5">
            {emailThread.slice(0, 5).map((m) => {
              // body is "Subject: …\n\n…" — surface just the subject line here
              const subj = m.body?.match(/^Subject:\s*(.+)$/m)?.[1] ?? m.body ?? "";
              return (
                <li
                  key={m.id}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1.5"
                >
                  <div className="truncate text-[12.5px] text-ink">{subj}</div>
                  <div className="eyebrow mt-0.5 text-[9px] text-ink-4">
                    Sent · {shortDate(m.occurred_at)}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {!hasEmail ? (
          <p className="text-[12px] text-ink-3">
            Add an email to this contact to send.
          </p>
        ) : !gmailConfigured ? (
          <p className="text-[12px] text-ink-3">
            Google sign-in isn&apos;t configured.
          </p>
        ) : (
          <>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={emailing}
              placeholder="Subject"
              className="field-input mb-2"
            />
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={4}
              disabled={emailing}
              placeholder="Write a quick email to the lead…"
              className="field-input"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              {emailResult && !emailResult.ok ? (
                <span className="text-[11px] text-danger">
                  {emailResult.reason}
                </span>
              ) : emailResult?.ok ? (
                <span className="text-[11px] text-brand">Sent — logged below.</span>
              ) : (
                <span className="text-[11px] text-ink-4">
                  Sent from your Gmail.
                </span>
              )}
              <button
                onClick={sendEmail}
                disabled={!subject.trim() || !emailBody.trim() || emailing}
                className="btn btn-primary btn-sm shrink-0"
              >
                <Send className="size-3.5" strokeWidth={2.2} />
                {emailing ? "Sending…" : "Send email"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
