"use client";

import { useState } from "react";
import { Sparkles, AlertTriangle, Copy, Check, Phone, MessageSquare, Mail } from "lucide-react";
import { aiGenerateReferralScripts } from "./actions";

type Scripts = { phone_opener: string; sms: string; email_subject: string; email_body: string };

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

/** Ask-script generator for the call roster — phone opener, SMS, and email
 * built from the program's real reward facts. */
export function ScriptsGenerator({ aiEnabled }: { aiEnabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scripts, setScripts] = useState<Scripts | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await aiGenerateReferralScripts();
      if (res.error || !res.scripts) {
        setError(res.error ?? "Generation failed.");
        return;
      }
      setScripts(res.scripts);
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
          <span className="block text-sm font-semibold text-ink">Ask scripts</span>
          <span className="block text-xs text-ink-3">
            What to say on the call, in a text, and by email — AI-drafted from the real reward facts.
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
            Set ANTHROPIC_API_KEY to enable script drafting.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <button type="button" className="btn btn-primary btn-sm disabled:opacity-50" onClick={run} disabled={busy}>
                <Sparkles className="h-3.5 w-3.5" /> {busy ? "Writing…" : scripts ? "Regenerate" : "Generate scripts"}
              </button>
              {error && !busy && <span className="text-xs text-danger">{error}</span>}
            </div>
            {scripts && (
              <div className="space-y-3">
                {[
                  { icon: Phone, label: "Phone opener", text: scripts.phone_opener },
                  { icon: MessageSquare, label: "Text message", text: scripts.sms },
                  { icon: Mail, label: "Email", text: `Subject: ${scripts.email_subject}\n\n${scripts.email_body}` },
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
