"use client";

import { useState } from "react";
import { Sparkles, AlertTriangle, Copy, Check, MessageSquare, Mail } from "lucide-react";
import { aiGenerateReviewRequest } from "./actions";

type Messages = { sms: string; email_subject: string; email_body: string };

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm text-ink-4"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Personalized review-ask writer: first name + job in, SMS + email out.
 * The [Google review link] placeholder stays for the team to paste. */
export function AskGenerator({ aiEnabled }: { aiEnabled: boolean }) {
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Messages | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await aiGenerateReviewRequest(name, job);
      if (res.error || !res.messages) {
        setError(res.error ?? "Generation failed.");
        return;
      }
      setMessages(res.messages);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="panel group reveal">
      <summary className="flex cursor-pointer select-none list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-hover">
        <span className="medallion medallion-info">
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-ink">Write the ask</span>
          <span className="block text-xs text-ink-3">
            Personalized review request — SMS and email — from a first name and the job.
          </span>
        </span>
        {aiEnabled ? (
          <span className="chip chip-outline !text-[10px]">AI ready</span>
        ) : (
          <span className="chip chip-warn !text-[10px]">AI provider missing</span>
        )}
      </summary>
      <div className="space-y-4 border-t border-line p-5">
        {!aiEnabled ? (
          <p className="flex items-start gap-2 text-xs text-ink-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warn" />
            Set ANTHROPIC_API_KEY to enable review-ask drafting.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-3">First name</label>
                <input className="field-input !h-9 w-40 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria" disabled={busy} />
              </div>
              <div className="min-w-56 flex-1">
                <label className="mb-1 block text-xs font-medium text-ink-3">Job just completed</label>
                <input className="field-input !h-9 text-sm" value={job} onChange={(e) => setJob(e.target.value)} placeholder="backyard turf install with putting green" disabled={busy} />
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm disabled:opacity-50"
                onClick={run}
                disabled={busy || !name.trim() || !job.trim()}
              >
                <Sparkles className="h-3.5 w-3.5" /> {busy ? "Writing…" : "Draft the ask"}
              </button>
            </div>
            {error && !busy && <p className="text-xs text-danger">{error}</p>}
            {messages && (
              <div className="space-y-3">
                <p className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-tint/50 px-3 py-2 text-xs text-ink-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warn" />
                  Swap [Google review link] for the real link before sending.
                </p>
                {[
                  { icon: MessageSquare, label: "Text message", text: messages.sms },
                  { icon: Mail, label: "Email", text: `Subject: ${messages.email_subject}\n\n${messages.email_body}` },
                ].map(({ icon: Icon, label, text }) => (
                  <div key={label} className="rounded-xl border border-line bg-hover/40 p-4">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="eyebrow flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </span>
                      <CopyBtn text={text} />
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{text}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
