"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { format, parseISO } from "date-fns";
import { addSubtask, type AddSubtaskState } from "./actions";
import type { TaskStatus, TaskPriority } from "@/lib/db-helpers.types";

type Subtask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string;
};

const initial: AddSubtaskState = { error: null, success: false };

const STATUS_DOT: Record<TaskStatus, string> = {
  inbox:       "bg-ink-4",
  in_progress: "bg-info",
  waiting:     "bg-info",
  blocked:     "bg-danger",
  done:        "bg-brand",
  archived:    "bg-line-strong",
};

export function SubtasksSection({
  parentId,
  subtasks,
}: {
  parentId: string;
  subtasks: Subtask[];
}) {
  const [state, formAction, isPending] = useActionState(addSubtask, initial);
  const [showAdd, setShowAdd] = useState(false);

  if (state.success && showAdd) setShowAdd(false);

  const remaining = subtasks.filter((s) => s.status !== "done").length;
  const done = subtasks.filter((s) => s.status === "done").length;

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-line">
        <div className="flex items-baseline gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-4">
            Subtasks
          </h3>
          {subtasks.length > 0 && (
            <span className="text-xs text-ink-3">
              {done}/{subtasks.length} done{remaining > 0 ? ` · ${remaining} open` : ""}
            </span>
          )}
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="px-2.5 py-1 text-xs font-medium border border-line rounded-md text-ink-2 hover:border-line-strong transition-colors"
          >
            + Add subtask
          </button>
        )}
      </div>

      {subtasks.length === 0 && !showAdd ? (
        <div className="px-5 py-6 text-center text-xs text-ink-4">
          No subtasks yet. Break this task down into smaller steps.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {subtasks.map((s) => (
            <li key={s.id}>
              <Link
                href={`/tasks/${s.id}`}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-hover transition-colors"
              >
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${STATUS_DOT[s.status]}`} />
                <span className={`flex-1 min-w-0 truncate text-sm ${s.status === "done" ? "line-through text-ink-4" : "text-ink"}`}>
                  {s.title}
                </span>
                {s.priority !== "normal" && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    s.priority === "urgent" ? "bg-danger-tint text-danger" :
                    s.priority === "high"   ? "bg-warn-tint text-warn" :
                                              "bg-hover text-ink-3"
                  }`}>
                    {s.priority}
                  </span>
                )}
                {s.due_date && (
                  <span className="text-[10px] text-ink-3 flex-shrink-0">
                    {format(parseISO(s.due_date), "MMM d")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <form action={formAction} className="border-t border-line px-5 py-3 space-y-2">
          <input type="hidden" name="parent_id" value={parentId} />
          <input
            name="title"
            placeholder="What needs to be done?"
            required
            autoFocus
            className="field-input"
          />
          <div className="grid grid-cols-2 gap-2">
            <select name="priority" defaultValue="normal" className="text-sm border border-line rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-line-strong">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input name="due_date" type="date" className="text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-line-strong" />
          </div>
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand-strong disabled:opacity-50"
            >
              {isPending ? "Adding…" : "Add subtask"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
