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
        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
      >
        <span className="text-base leading-none">+</span> Invite user
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-sm font-semibold">Invite a teammate</h2>
        <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none" aria-label="Close">
          ×
        </button>
      </div>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="departments" value={departments.join(",")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Email *</label>
            <input
              name="email"
              type="email"
              placeholder="someone@texasturfusa.com"
              required
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Full name (optional)</label>
            <input
              name="full_name"
              type="text"
              placeholder="Maximilian Garcia"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Role</label>
          <select
            name="role"
            defaultValue="field"
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="field">Field — installer view, read-only on shared tools</option>
            <option value="office">Office — full operational access</option>
            <option value="admin">Admin — everything + user management</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Departments</label>
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
                      ? "border-blue-400 bg-blue-100 text-blue-800"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400")
                  }
                  aria-pressed={on}
                >
                  <span>{DEPARTMENT_EMOJI[d]}</span>
                  {DEPARTMENT_LABEL[d]}
                  {on && <span className="text-blue-600">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {state.error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}
        {state.success && state.sentTo && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            ✓ Invite sent to <strong>{state.sentTo}</strong>. They'll get a magic-link email.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-1.5 text-sm font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
