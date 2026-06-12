"use client";

import { useActionState, useState } from "react";
import { updateUser, type UpdateUserState } from "./actions";
import { DeleteUserButton } from "./delete-button";
import {
  DEPARTMENTS,
  DEPARTMENT_LABEL,
  DEPARTMENT_EMOJI,
  type Department,
} from "@/lib/departments";

const initial: UpdateUserState = { error: null, success: false };

type Row = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  departments: Department[];
};

const ROLE_BADGE: Record<string, string> = {
  admin:  "bg-info-tint text-info",
  office: "bg-info-tint text-info",
  field:  "bg-brand-tint text-brand",
};

export function UserRow({ user, currentUserId }: { user: Row; currentUserId: string }) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(user.role);
  const [departments, setDepartments] = useState<Department[]>(user.departments);
  const [state, formAction, isPending] = useActionState(updateUser, initial);

  if (state.success && editing) setEditing(false);

  function toggleDept(d: Department) {
    setDepartments((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  const isSelf = user.id === currentUserId;

  if (!editing) {
    return (
      <tr className="hover:bg-hover">
        <td className="px-4 py-3 font-medium text-ink">
          {user.full_name ?? "—"}
          {isSelf && <span className="ml-2 text-xs text-ink-4 font-normal">(you)</span>}
        </td>
        <td className="px-4 py-3 text-ink-2">{user.email}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[user.role] ?? "bg-sunken text-ink-2"}`}>
            {user.role}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {user.departments.length === 0 ? (
              <span className="text-xs text-ink-4">— None</span>
            ) : (
              user.departments.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-md bg-sunken px-1.5 py-0.5 text-xs text-ink-2">
                  <span>{DEPARTMENT_EMOJI[d]}</span>
                  {DEPARTMENT_LABEL[d]}
                </span>
              ))
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="inline-flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-2.5 py-1 text-xs font-medium border border-line rounded-md text-ink-2 hover:border-line-strong transition-colors"
            >
              Edit
            </button>
            {!isSelf && (
              <DeleteUserButton
                userId={user.id}
                userLabel={user.full_name ?? user.email}
              />
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-info-tint/30">
      <td className="px-4 py-3 font-medium text-ink align-top">
        {user.full_name ?? "—"}
        {isSelf && <span className="ml-2 text-xs text-ink-4 font-normal">(you)</span>}
      </td>
      <td className="px-4 py-3 text-ink-2 align-top">{user.email}</td>
      <td className="px-4 py-3 align-top">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={isSelf}
          className="w-full text-sm border border-line rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-line-strong disabled:opacity-60"
        >
          <option value="admin">Admin</option>
          <option value="office">Office</option>
          <option value="field">Field</option>
        </select>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-1.5">
          {DEPARTMENTS.map((d) => {
            const on = departments.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDept(d)}
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
      </td>
      <td className="px-4 py-3 align-top text-right">
        <form action={formAction} className="inline-flex flex-col items-end gap-2">
          <input type="hidden" name="user_id" value={user.id} />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="departments" value={departments.join(",")} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setEditing(false); setRole(user.role); setDepartments(user.departments); }}
              className="px-2.5 py-1 text-xs text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-3 py-1 text-xs font-semibold bg-ink text-white rounded-md hover:bg-ink disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
          {state.error && (
            <p className="text-xs text-danger max-w-xs text-right">{state.error}</p>
          )}
        </form>
      </td>
    </tr>
  );
}
