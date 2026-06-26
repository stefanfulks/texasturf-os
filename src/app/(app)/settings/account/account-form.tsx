"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { DEPARTMENTS, DEPARTMENT_LABEL, DEPARTMENT_ICON } from "@/lib/departments";
import { updateAccount, type UpdateAccountState } from "./actions";

const initial: UpdateAccountState = { error: null, success: false };

const fieldCls =
  "field-input";

export function AccountForm({
  fullName,
  email,
  mobile,
  role,
  departments,
}: {
  fullName: string;
  email: string;
  mobile: string;
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
              className={`${fieldCls} bg-hover text-ink-3 cursor-not-allowed`}
            />
          </Field>
        </div>
        <Field label="Mobile" hint="Used for click-to-call from Sales — rings this phone.">
          <input
            name="mobile"
            type="tel"
            inputMode="tel"
            defaultValue={mobile}
            className={fieldCls}
            placeholder="+1 512 555 0142"
          />
        </Field>
        <Field label="Role" hint="Set by an admin in /team.">
          <input
            type="text"
            value={role ?? "—"}
            disabled
            className={`${fieldCls} bg-hover text-ink-3 cursor-not-allowed capitalize`}
          />
        </Field>
      </Section>

      <Section title="Departments" hint="Pick every department you work across. Drives the Dashboard's snapshot.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DEPARTMENTS.map((dept) => {
            const on = picked.includes(dept);
            const Icon = DEPARTMENT_ICON[dept];
            return (
              <button
                key={dept}
                type="button"
                onClick={() => toggle(dept)}
                className={
                  "flex items-center gap-2 h-12 rounded-xl border px-3 text-sm font-medium text-left transition-colors " +
                  (on
                    ? "border-ink bg-brand text-white"
                    : "border-line bg-white text-ink-2 active:bg-hover")
                }
              >
                <span className="medallion"><Icon className="h-[18px] w-[18px]" /></span>
                <span>{DEPARTMENT_LABEL[dept]}</span>
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
        <div className="flex gap-2 rounded-xl border border-danger/30 bg-danger-tint p-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      {state.success && (
        <div className="flex gap-2 rounded-xl border border-brand/30 bg-brand-tint p-3 text-sm text-brand">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Saved.</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary h-11 px-5 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {hint && <p className="text-xs text-ink-3 mt-0.5">{hint}</p>}
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
      <span className="flex items-baseline justify-between text-xs font-semibold text-ink-2 mb-1.5">
        <span>
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
        {hint && <span className="font-normal text-ink-4">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
