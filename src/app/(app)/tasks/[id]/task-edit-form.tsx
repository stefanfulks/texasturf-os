"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { updateTask, type UpdateTaskState } from "./actions";
import { updateTaskAssignees } from "../actions";
import type { Task, Profile } from "@/lib/db-helpers.types";

const initial: UpdateTaskState = { error: null, success: false };

const field =
  "field-input";

const AVATAR_COLORS = [
  "bg-info-tint text-info",
  "bg-info-tint text-info",
  "bg-warn-tint text-warn",
  "bg-brand-tint text-brand",
  "bg-info-tint text-info",
  "bg-info-tint text-info",
];
function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// The title field is a textarea (not a single-line input) so long task titles
// wrap and stay fully on screen instead of scrolling off the right edge. Grow
// it to fit its content; Enter still saves rather than inserting a newline, so
// titles stay logically single-line.
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function TaskEditForm({
  task,
  allProfiles,
  initialAssigneeIds,
}: {
  task: Task;
  allProfiles: Array<Pick<Profile, "id" | "full_name" | "email">>;
  initialAssigneeIds: string[];
}) {
  const [state, formAction, isPending] = useActionState(updateTask, initial);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialAssigneeIds);
  const [savingAssignees, startAssigneesTransition] = useTransition();
  const [assigneeMsg, setAssigneeMsg] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Size the title to fit its initial value once mounted.
  useEffect(() => {
    autoGrow(titleRef.current);
  }, []);

  const profileById = new Map(allProfiles.map((p) => [p.id, p]));
  const taggedProfiles = assigneeIds.map((id) => profileById.get(id)).filter(Boolean) as Array<Pick<Profile, "id" | "full_name" | "email">>;

  function toggle(id: string) {
    setAssigneeMsg(null);
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function makePrimary(id: string) {
    setAssigneeMsg(null);
    setAssigneeIds((prev) => [id, ...prev.filter((x) => x !== id)]);
  }

  function saveAssignees() {
    if (assigneeIds.length === 0) {
      setAssigneeMsg("Tag at least one person.");
      return;
    }
    startAssigneesTransition(async () => {
      const result = await updateTaskAssignees(task.id, assigneeIds);
      setAssigneeMsg(result.error ? result.error : "Tags saved.");
    });
  }

  return (
    <div className="space-y-6">
      {/* Tagged people block — saves independently of the rest of the form. */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-xs font-semibold text-ink-2">Tagged people</label>
          <span className="text-[10px] text-ink-4">{assigneeIds.length} tagged</span>
        </div>

        {taggedProfiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {taggedProfiles.map((p, i) => (
              <span
                key={p.id}
                className={`inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 h-8 text-xs font-medium ${
                  i === 0 ? "bg-brand text-white" : "bg-sunken text-ink"
                }`}
              >
                <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${colorFor(p.id)}`}>
                  {(p.full_name ?? p.email)[0]?.toUpperCase()}
                </span>
                <span>{p.full_name ?? p.email.split("@")[0]}</span>
                {i === 0 ? (
                  <span className="text-[9px] uppercase tracking-wider opacity-80">primary</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makePrimary(p.id)}
                    className="text-[10px] uppercase tracking-wider text-ink-3 hover:text-ink underline"
                    title="Make primary"
                  >
                    set primary
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-label="Remove"
                  className="opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <details className="group">
          <summary className="list-none cursor-pointer h-10 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink group-open:border-solid">
            <span className="text-base leading-none">+</span> Add / remove people
          </summary>
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-line bg-white divide-y divide-line">
            {allProfiles.map((p) => {
              const isOn = assigneeIds.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`w-full flex items-center gap-2.5 h-11 px-3 text-left text-sm transition-colors ${
                      isOn ? "bg-hover text-ink" : "text-ink-2 hover:bg-hover"
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${colorFor(p.id)}`}>
                      {(p.full_name ?? p.email)[0]?.toUpperCase()}
                    </span>
                    <span className="flex-1 truncate">{p.full_name ?? p.email}</span>
                    <span className={`w-5 h-5 rounded border flex items-center justify-center ${isOn ? "bg-brand border-ink text-white" : "border-line-strong"}`}>
                      {isOn && (
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </details>

        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={saveAssignees}
            disabled={savingAssignees}
            className="h-10 px-4 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-strong active:bg-brand-strong disabled:opacity-50"
          >
            {savingAssignees ? "Saving…" : "Save tags"}
          </button>
          {assigneeMsg && (
            <span className={`text-xs ${assigneeMsg === "Tags saved." ? "text-brand" : "text-danger"}`}>
              {assigneeMsg}
            </span>
          )}
        </div>
      </div>

      {/* The rest of the form */}
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={task.id} />

        <textarea
          ref={titleRef}
          name="title"
          defaultValue={task.title}
          required
          rows={1}
          onInput={(e) => autoGrow(e.currentTarget)}
          onKeyDown={(e) => {
            // Keep titles single-line: Enter saves instead of adding a newline.
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="w-full resize-none overflow-hidden text-lg font-semibold leading-snug border-0 border-b border-line pb-2 focus:outline-none focus:border-line-strong bg-transparent text-ink placeholder:text-ink-4"
          placeholder="Task title"
        />

        <textarea
          name="description"
          defaultValue={task.description ?? ""}
          rows={3}
          placeholder="Add a description…"
          className="w-full text-base border border-line-strong rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink placeholder:text-ink-4 resize-none"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">Status</label>
            <select name="status" defaultValue={task.status} className={field}>
              <option value="inbox">Inbox</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting">Waiting</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">Priority</label>
            <select name="priority" defaultValue={task.priority} className={field}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">Due date</label>
            <input type="date" name="due_date" defaultValue={task.due_date ?? ""} className={field} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Blocked reason</label>
          <input
            name="blocked_reason"
            defaultValue={task.blocked_reason ?? ""}
            placeholder="What's blocking this? (required when status is Blocked)"
            className={field}
          />
        </div>

        {state.success && (
          <p className="text-sm text-brand bg-brand-tint border border-brand/30 rounded-xl px-3 py-2">Saved.</p>
        )}
        {state.error && (
          <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-xl px-3 py-2">{state.error}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary h-11 px-5 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
