"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import { TaskEditForm } from "@/app/(app)/tasks/[id]/task-edit-form";
import type { Task, Profile } from "@/lib/database.types";

/**
 * Side panel that opens over the tasks list when ?taskId=... is in the URL.
 * Embeds the same edit form as the full /tasks/[id] page so users can
 * read/edit without losing the list view. The full route is still there
 * for permalinks, cmd-click into a new tab, and the comments/subtasks/
 * activity sections that don't fit in a panel.
 */
export function TaskSlideOver({
  task,
  allProfiles,
  initialAssigneeIds,
}: {
  task: Task;
  allProfiles: Array<Pick<Profile, "id" | "full_name" | "email">>;
  initialAssigneeIds: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  function close() {
    const next = new URLSearchParams(params);
    next.delete("taskId");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  // Close on Escape — feels expected for a side panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pathname]);

  return (
    <>
      {/* Scrim — clicking outside closes. Mobile takes full screen so the
          scrim isn't visible there, but the close button still works. */}
      <div
        className="fixed inset-0 bg-black/30 z-30"
        onClick={close}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        className="fixed inset-y-0 right-0 z-40 w-full sm:w-[40rem] bg-white shadow-2xl flex flex-col"
      >
        <header className="sticky top-0 z-10 bg-white border-b border-zinc-100 px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Task</p>
            <p className="text-sm font-semibold text-zinc-900 truncate">{task.title}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link
              href={`/tasks/${task.id}`}
              title="Open full page (comments, subtasks, activity)"
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={close}
              title="Close (Esc)"
              aria-label="Close"
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5">
          <TaskEditForm
            task={task}
            allProfiles={allProfiles}
            initialAssigneeIds={initialAssigneeIds}
          />
          <div className="mt-6 pt-5 border-t border-zinc-100">
            <Link
              href={`/tasks/${task.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              See comments, subtasks &amp; activity
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
