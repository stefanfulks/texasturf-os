"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { format, parseISO } from "date-fns";
import { addSubtask, type AddSubtaskState } from "./actions";
import type { TaskStatus, TaskPriority } from "@/lib/database.types";

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
  inbox:       "bg-zinc-400",
  in_progress: "bg-blue-500",
  waiting:     "bg-purple-500",
  blocked:     "bg-red-500",
  done:        "bg-green-500",
  archived:    "bg-zinc-300",
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
    <section className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
        <div className="flex items-baseline gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Subtasks
          </h3>
          {subtasks.length > 0 && (
            <span className="text-xs text-zinc-500">
              {done}/{subtasks.length} done{remaining > 0 ? ` · ${remaining} open` : ""}
            </span>
          )}
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="px-2.5 py-1 text-xs font-medium border border-zinc-200 rounded-md text-zinc-700 hover:border-zinc-400 transition-colors"
          >
            + Add subtask
          </button>
        )}
      </div>

      {subtasks.length === 0 && !showAdd ? (
        <div className="px-5 py-6 text-center text-xs text-zinc-400">
          No subtasks yet. Break this task down into smaller steps.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {subtasks.map((s) => (
            <li key={s.id}>
              <Link
                href={`/tasks/${s.id}`}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50 transition-colors"
              >
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${STATUS_DOT[s.status]}`} />
                <span className={`flex-1 min-w-0 truncate text-sm ${s.status === "done" ? "line-through text-zinc-400" : "text-zinc-900"}`}>
                  {s.title}
                </span>
                {s.priority !== "normal" && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    s.priority === "urgent" ? "bg-red-50 text-red-700" :
                    s.priority === "high"   ? "bg-amber-50 text-amber-700" :
                                              "bg-zinc-50 text-zinc-500"
                  }`}>
                    {s.priority}
                  </span>
                )}
                {s.due_date && (
                  <span className="text-[10px] text-zinc-500 flex-shrink-0">
                    {format(parseISO(s.due_date), "MMM d")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <form action={formAction} className="border-t border-zinc-100 px-5 py-3 space-y-2">
          <input type="hidden" name="parent_id" value={parentId} />
          <input
            name="title"
            placeholder="What needs to be done?"
            required
            autoFocus
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
          <div className="grid grid-cols-2 gap-2">
            <select name="priority" defaultValue="normal" className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input name="due_date" type="date" className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
          </div>
          {state.error && <p className="text-xs text-red-600">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
            >
              {isPending ? "Adding…" : "Add subtask"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
