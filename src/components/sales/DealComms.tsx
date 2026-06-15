"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageSquare, Send } from "lucide-react";
import type { DealActivity } from "@/lib/sales/types";
import { shortDate } from "@/lib/sales/format";
import { startCall, sendSms, type CommResult } from "@/app/(app)/sales/comms-actions";

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
  smsActivities,
  twilioConfigured,
  smsConfigured,
}: {
  dealId: string;
  contactId: string | null;
  contactPhone: string | null;
  smsActivities: DealActivity[];
  twilioConfigured: boolean;
  smsConfigured: boolean;
}) {
  const router = useRouter();
  const hasPhone = Boolean(contactPhone?.trim()) && Boolean(contactId);

  const [calling, startCalling] = useTransition();
  const [callResult, setCallResult] = useState<CommResult | null>(null);

  const [draft, setDraft] = useState("");
  const [texting, startTexting] = useTransition();
  const [smsResult, setSmsResult] = useState<CommResult | null>(null);

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
    </div>
  );
}
