"use client";

import { useMemo, useState, useTransition } from "react";
import { Save, Lock } from "lucide-react";
import { saveBusinessInputs } from "./actions";

export type BusinessInput = {
  input_key: string;
  label: string;
  input_type: string;
  value: string | null;
};

/** The owner's real numbers — amber until filled, admin-write. Everything the
 * AI generators and break-even math run on comes from here; AI never invents
 * these values. */
export function BusinessInputsEditor({
  inputs,
  isAdmin,
}: {
  inputs: BusinessInput[];
  isAdmin: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(inputs.map((i) => [i.input_key, i.value ?? ""])),
  );
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const filledCount = useMemo(
    () => inputs.filter((i) => values[i.input_key]?.trim()).length,
    [inputs, values],
  );

  const dirty = useMemo(
    () => inputs.some((i) => (values[i.input_key] ?? "") !== (i.value ?? "")),
    [inputs, values],
  );

  function save() {
    setNote(null);
    const entries = inputs
      .filter((i) => (values[i.input_key] ?? "") !== (i.value ?? ""))
      .map((i) => ({ input_key: i.input_key, value: values[i.input_key] ?? null }));
    startTransition(async () => {
      const res = await saveBusinessInputs(entries);
      if (res.error) setNote({ kind: "error", text: res.error });
      else setNote({ kind: "ok", text: `Saved ${res.saved} input${res.saved === 1 ? "" : "s"}.` });
    });
  }

  return (
    <section className="panel reveal">
      <div className="panel-head">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">Your numbers</span>
          <span className={`chip ${filledCount === inputs.length ? "chip-brand" : "chip-warn"} !text-[10px]`}>
            {filledCount}/{inputs.length} filled
          </span>
        </div>
        {!isAdmin && (
          <span className="flex items-center gap-1 text-xs text-ink-4">
            <Lock className="h-3 w-3" /> admin edits
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 p-5 sm:grid-cols-2">
        {inputs.map((i) => {
          const v = values[i.input_key] ?? "";
          const empty = !v.trim();
          return (
            <div key={i.input_key}>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-3">
                {empty && <span className="dot bg-warn" title="Not provided yet" />}
                {i.label}
              </label>
              <input
                className={`field-input ${empty ? "border-warn/50" : ""}`}
                type={i.input_type === "number" ? "number" : "text"}
                value={v}
                onChange={(e) => setValues((prev) => ({ ...prev, [i.input_key]: e.target.value }))}
                placeholder={empty ? "Fill me in" : undefined}
                disabled={!isAdmin || pending}
              />
            </div>
          );
        })}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-3 border-t border-line px-5 py-3.5">
          <button
            type="button"
            className="btn btn-primary btn-sm disabled:opacity-50"
            onClick={save}
            disabled={pending || !dirty}
          >
            <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save numbers"}
          </button>
          {note && (
            <span className={`text-xs ${note.kind === "error" ? "text-danger" : "text-brand"}`}>{note.text}</span>
          )}
        </div>
      )}
    </section>
  );
}
