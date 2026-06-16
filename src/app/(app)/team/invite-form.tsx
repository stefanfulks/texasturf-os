"use client";

import { useActionState, useState } from "react";
import { inviteUser, type InviteUserState } from "./actions";
import {
  DEPARTMENTS,
  DEPARTMENT_LABEL,
  DEPARTMENT_EMOJI,
  type Department,
} from "@/lib/departments";

const initial: InviteUserState = { error: null, success: false, sentTo: null };

export function InviteUserForm() {
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [state, formAction, isPending] = useActionState(inviteUser, initial);

  // Reset + close on successful invite
  if (state.success && open) {
    setTimeout(() => { setOpen(false); setDepartments([]); }, 1500);
  }

  function toggle(d: Department) {
    setDepartments((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-strong transition-colors"
      >
        <span className="text-base leading-none">+</span> Invite user
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-sm font-semibold">Invite a teammate</h2>
        <button onClick={() => setOpen(false)} className="text-ink-4 hover:text-ink-2 text-xl leading-none" aria-label="Close">
          ×
        </button>
      </div>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="departments" value={departments.join(",")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Email <span className="text-danger">*</span></label>
            <input
              name="email"
              type="email"
              placeholder="someone@texasturfusa.com"
              required
              className="field-input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Full name (optional)</label>
            <input
              name="full_name"
              type="text"
              placeholder="Maximilian Garcia"
              className="field-input"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Role</label>
          <select
            name="role"
            defaultValue="field"
            className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-line-strong"
          >
            <option value="field">Field — installer view, read-only on shared tools</option>
            <option value="office">Office — full operational access</option>
            <option value="admin">Admin — everything + user management</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Departments</label>
          <div className="flex flex-wrap gap-1.5">
            {DEPARTMENTS.map((d) => {
              const on = departments.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggle(d)}
                  className={
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors " +
                    (on
                      ? "border-info/30 bg-info-tint text-info"
                      : "border-line bg-white text-ink-2 hover:border-line-strong")
                  }
                  aria-pressed={on}
                >
                  <span>{DEPARTMENT_EMOJI[d]}</span>
                  {DEPARTMENT_LABEL[d]}
                  {on && <span className="text-info">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {state.error && (
          <p className="text-xs text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}
        {state.success && state.sentTo && (
          <p className="text-xs text-brand bg-brand-tint border border-brand/30 rounded-lg px-3 py-2">
            ✓ <strong>{state.sentTo}</strong> added — they sign in with their @texasturfusa.com Google account. No email needed.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-sm text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-1.5 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-strong disabled:opacity-50"
          >
            {isPending ? "Adding…" : "Add to team"}
          </button>
        </div>
      </form>
    </div>
  );
}
