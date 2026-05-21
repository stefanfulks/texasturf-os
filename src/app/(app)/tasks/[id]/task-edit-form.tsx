"use client";

import { useActionState } from "react";
import { updateTask, type UpdateTaskState } from "./actions";
import type { Task } from "@/lib/database.types";

const initial: UpdateTaskState = { error: null, success: false };

const field = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";

export function TaskEditForm({ task }: { task: Task }) {
  const [state, formAction, isPending] = useActionState(updateTask, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={task.id} />

      {/* Title */}
      <input
        name="title"
        defaultValue={task.title}
        required
        className="w-full text-lg font-semibold border-0 border-b border-zinc-200 pb-2 focus:outline-none focus:border-zinc-400 bg-transparent text-zinc-900 placeholder:text-zinc-400"
        placeholder="Task title"
      />

      {/* Description */}
      <textarea
        name="description"
        defaultValue={task.description ?? ""}
        rows={3}
        placeholder="Add a description…"
        className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-400 resize-none"
      />

      {/* Status / Priority / Due date */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Status</label>
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
          <label className="block text-xs font-medium text-zinc-500 mb-1">Priority</label>
          <select name="priority" defaultValue={task.priority} className={field}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Due date</label>
          <input type="date" name="due_date" defaultValue={task.due_date ?? ""} className={field} />
        </div>
      </div>

      {/* Blocked reason */}
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Blocked reason</label>
        <input
          name="blocked_reason"
          defaultValue={task.blocked_reason ?? ""}
          placeholder="What's blocking this? (required when status is Blocked)"
          className={field}
        />
      </div>

      {state.success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Saved.</p>
      )}
      {state.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
