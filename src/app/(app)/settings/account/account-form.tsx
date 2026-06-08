"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { updateAccount, type UpdateAccountState } from "./actions";

const initial: UpdateAccountState = { error: null, success: false };

const fieldCls =
  "w-full h-12 text-base border border-zinc-300 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 bg-white";

const DEPARTMENTS = [
  { key: "sales",     label: "Sales",     emoji: "💼" },
  { key: "warehouse", label: "Warehouse", emoji: "📦" },
  { key: "office",    label: "Office",    emoji: "🏢" },
  { key: "field",     label: "Field",     emoji: "🏗️" },
  { key: "marketing", label: "Marketing", emoji: "📣" },
  { key: "financial", label: "Financial", emoji: "💰" },
];

export function AccountForm({
  fullName,
  email,
  role,
  departments,
}: {
  fullName: string;
  email: string;
  role: string | null;
  departments: string[];
}) {
  const [state, formAction, pending] = useActionState(updateAccount, initial);
  const [picked, setPicked] = useState<string[]>(departments);

  function toggle(key: string) {
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <form action={formAction} className="space-y-4">
      <Section title="Profile">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name" required>
            <input
              name="full_name"
              type="text"
              defaultValue={fullName}
              required
              className={fieldCls}
              placeholder="Your name"
            />
          </Field>
          <Field label="Email" hint="Read-only — set by your Google sign-in.">
            <input
              type="email"
              value={email}
              disabled
              className={`${fieldCls} bg-zinc-50 text-zinc-500 cursor-not-allowed`}
            />
          </Field>
        </div>
        <Field label="Role" hint="Set by an admin in /team.">
          <input
            type="text"
            value={role ?? "—"}
            disabled
            className={`${fieldCls} bg-zinc-50 text-zinc-500 cursor-not-allowed capitalize`}
          />
        </Field>
      </Section>

      <Section title="Departments" hint="Pick every department you work across. Drives the Dashboard's snapshot.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DEPARTMENTS.map((d) => {
            const on = picked.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => toggle(d.key)}
                className={
                  "flex items-center gap-2 h-12 rounded-xl border px-3 text-sm font-medium text-left transition-colors " +
                  (on
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50")
                }
              >
                <span className="text-base leading-none">{d.emoji}</span>
                <span>{d.label}</span>
              </button>
            );
          })}
        </div>
        {/* Hidden inputs so the form action picks up the multi-select. */}
        {picked.map((k) => (
          <input key={k} type="hidden" name="departments" value={k} />
        ))}
      </Section>

      {state.error && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      {state.success && (
        <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Saved.</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="h-11 px-5 text-sm font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {hint && <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs font-semibold text-zinc-700 mb-1.5">
        <span>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {hint && <span className="font-normal text-zinc-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
