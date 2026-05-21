"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { format, isToday, isPast, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { updateTaskStatus, completeTask, createTask } from "@/app/(app)/tasks/actions";
import type { Task, TaskStatus, TaskPriority } from "@/lib/database.types";

// ─── Config ────────────────────────────────────────────────────────────────────

const COLUMNS: { status: Exclude<TaskStatus, "archived">; label: string; color: string; headerBg: string }[] = [
  { status: "inbox",       label: "Inbox",       color: "text-zinc-500",  headerBg: "bg-zinc-100" },
  { status: "in_progress", label: "In Progress", color: "text-blue-600",  headerBg: "bg-blue-50"  },
  { status: "waiting",     label: "Waiting",     color: "text-purple-600",headerBg: "bg-purple-50"},
  { status: "blocked",     label: "Blocked",     color: "text-red-600",   headerBg: "bg-red-50"   },
  { status: "done",        label: "Done",        color: "text-green-600", headerBg: "bg-green-50" },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dot: string; badge: string }> = {
  low:    { label: "Low",    dot: "bg-zinc-300",   badge: "bg-zinc-100 text-zinc-500"   },
  normal: { label: "Normal", dot: "bg-blue-400",   badge: "bg-blue-50 text-blue-600"    },
  high:   { label: "High",   dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700"  },
  urgent: { label: "Urgent", dot: "bg-red-500",    badge: "bg-red-50 text-red-700"      },
};

// ─── Main Board ────────────────────────────────────────────────────────────────

export function TaskBoard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("inbox");

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : t.completed_at }
          : t,
      ),
    );
    updateTaskStatus(taskId, newStatus);
  };

  const handleComplete = (taskId: string) => {
    handleStatusChange(taskId, "done");
  };

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setShowCreateDialog(false);
  };

  const openCreate = (status: TaskStatus) => {
    setCreateStatus(status);
    setShowCreateDialog(true);
  };

  const activeTasks = tasks.filter((t) => t.status !== "archived");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {activeTasks.filter((t) => t.status !== "done").length} open ·{" "}
            {activeTasks.filter((t) => t.due_date && isPast(parseISO(t.due_date)) && t.status !== "done").length} overdue
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border border-zinc-200 overflow-hidden text-sm">
            <button
              onClick={() => setView("kanban")}
              className={cn("px-3 py-1.5 font-medium transition-colors", view === "kanban" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50")}
            >
              Board
            </button>
            <button
              onClick={() => setView("list")}
              className={cn("px-3 py-1.5 font-medium transition-colors border-l border-zinc-200", view === "list" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50")}
            >
              List
            </button>
          </div>
          <button
            onClick={() => openCreate("inbox")}
            className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            <span className="text-base leading-none">+</span> New Task
          </button>
        </div>
      </div>

      {/* Board */}
      {view === "kanban" ? (
        <KanbanView
          tasks={activeTasks}
          onStatusChange={handleStatusChange}
          onComplete={handleComplete}
          onAddTask={openCreate}
        />
      ) : (
        <ListView
          tasks={activeTasks}
          onStatusChange={handleStatusChange}
          onComplete={handleComplete}
        />
      )}

      {/* Create dialog */}
      {showCreateDialog && (
        <CreateTaskDialog
          defaultStatus={createStatus}
          onCreated={handleTaskCreated}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}

// ─── Kanban View ───────────────────────────────────────────────────────────────

function KanbanView({
  tasks,
  onStatusChange,
  onComplete,
  onAddTask,
}: {
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onComplete: (id: string) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 flex-1" style={{ minHeight: 0 }}>
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="flex flex-col w-72 flex-shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden">
            {/* Column header */}
            <div className={cn("flex items-center justify-between px-3 py-2.5 border-b border-zinc-200", col.headerBg)}>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-semibold", col.color)}>{col.label}</span>
                <span className="text-xs text-zinc-400 font-medium bg-white border border-zinc-200 rounded-full px-1.5 py-0.5 leading-none">
                  {colTasks.length}
                </span>
              </div>
              <button
                onClick={() => onAddTask(col.status)}
                className="text-zinc-400 hover:text-zinc-700 text-lg leading-none font-light"
                title={`Add to ${col.label}`}
              >
                +
              </button>
            </div>

            {/* Tasks */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {colTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-400">
                  {col.status === "done" ? "Completed tasks appear here" : "No tasks"}
                </div>
              ) : (
                colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={onStatusChange}
                    onComplete={onComplete}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onStatusChange,
  onComplete,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onComplete: (id: string) => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [, startTransition] = useTransition();
  const isDone = task.status === "done";
  const isOverdue = task.due_date && !isDone && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const isDueToday = task.due_date && !isDone && isToday(parseISO(task.due_date));
  const priority = PRIORITY_CONFIG[task.priority];

  return (
    <div className={cn(
      "bg-white rounded-lg border p-3 group hover:shadow-sm transition-shadow",
      isDone ? "border-zinc-100 opacity-60" : "border-zinc-200",
      task.status === "blocked" ? "border-red-200 bg-red-50/50" : ""
    )}>
      <div className="flex items-start gap-2">
        {/* Complete button */}
        <button
          onClick={() => {
            if (!isDone) {
              startTransition(() => onComplete(task.id));
            }
          }}
          className={cn(
            "mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors",
            isDone
              ? "border-green-400 bg-green-400"
              : "border-zinc-300 hover:border-green-400 group-hover:border-zinc-400"
          )}
          title={isDone ? "Completed" : "Mark done"}
        >
          {isDone && (
            <svg className="w-full h-full text-white p-0.5" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/tasks/${task.id}`}
            className={cn(
              "text-sm font-medium leading-snug block hover:underline",
              isDone ? "line-through text-zinc-400" : "text-zinc-900"
            )}
          >
            {task.title}
          </Link>

          {/* Meta row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {/* Priority (show if not normal) */}
            {task.priority !== "normal" && (
              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", priority.badge)}>
                {priority.label}
              </span>
            )}

            {/* Due date */}
            {task.due_date && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded font-medium",
                isOverdue  ? "bg-red-50 text-red-600"    :
                isDueToday ? "bg-amber-50 text-amber-700" :
                             "bg-zinc-50 text-zinc-500"
              )}>
                {isOverdue  ? "Overdue" :
                 isDueToday ? "Today"   :
                 format(parseISO(task.due_date), "MMM d")}
              </span>
            )}

            {/* Blocked reason */}
            {task.status === "blocked" && task.blocked_reason && (
              <span className="text-xs text-red-500 truncate max-w-[120px]" title={task.blocked_reason}>
                🚫 {task.blocked_reason}
              </span>
            )}
          </div>
        </div>

        {/* Status picker */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className={cn(
              "w-2 h-2 rounded-full mt-1 transition-transform hover:scale-125",
              task.status === "inbox"       ? "bg-zinc-400"   :
              task.status === "in_progress" ? "bg-blue-500"   :
              task.status === "waiting"     ? "bg-purple-500" :
              task.status === "blocked"     ? "bg-red-500"    :
              "bg-green-500"
            )}
            title="Change status"
          />
          {statusOpen && (
            <StatusDropdown
              current={task.status}
              onSelect={(s) => {
                setStatusOpen(false);
                startTransition(() => onStatusChange(task.id, s));
              }}
              onClose={() => setStatusOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Status Dropdown ──────────────────────────────────────────────────────────

function StatusDropdown({
  current,
  onSelect,
  onClose,
}: {
  current: TaskStatus;
  onSelect: (s: TaskStatus) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-4 z-20 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 min-w-[140px]">
        {COLUMNS.map((col) => (
          <button
            key={col.status}
            onClick={() => onSelect(col.status)}
            className={cn(
              "w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-2 hover:bg-zinc-50 transition-colors",
              current === col.status ? "text-zinc-900" : "text-zinc-600"
            )}
          >
            <span className={cn(
              "w-2 h-2 rounded-full flex-shrink-0",
              col.status === "inbox"       ? "bg-zinc-400"   :
              col.status === "in_progress" ? "bg-blue-500"   :
              col.status === "waiting"     ? "bg-purple-500" :
              col.status === "blocked"     ? "bg-red-500"    :
              "bg-green-500"
            )} />
            {col.label}
            {current === col.status && <span className="ml-auto text-zinc-400">✓</span>}
          </button>
        ))}
      </div>
    </>
  );
}

// ─── List View ─────────────────────────────────────────────────────────────────

function ListView({
  tasks,
  onStatusChange,
  onComplete,
}: {
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onComplete: (id: string) => void;
}) {
  const sorted = [...tasks].sort((a, b) => {
    // Overdue first, then by priority weight, then due date
    const pa = { urgent: 0, high: 1, normal: 2, low: 3 }[a.priority];
    const pb = { urgent: 0, high: 1, normal: 2, low: 3 }[b.priority];
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  return (
    <div className="space-y-1">
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-sm text-zinc-400">No tasks yet</div>
      ) : (
        sorted.map((task) => <ListRow key={task.id} task={task} onStatusChange={onStatusChange} onComplete={onComplete} />)
      )}
    </div>
  );
}

function ListRow({
  task,
  onStatusChange,
  onComplete,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onComplete: (id: string) => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [, startTransition] = useTransition();
  const isDone = task.status === "done";
  const isOverdue = task.due_date && !isDone && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const isDueToday = task.due_date && !isDone && isToday(parseISO(task.due_date));
  const priority = PRIORITY_CONFIG[task.priority];
  const col = COLUMNS.find((c) => c.status === task.status)!;

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white hover:shadow-sm transition-shadow group",
      isDone ? "border-zinc-100 opacity-60" : "border-zinc-200",
    )}>
      <button
        onClick={() => !isDone && startTransition(() => onComplete(task.id))}
        className={cn(
          "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors",
          isDone ? "border-green-400 bg-green-400" : "border-zinc-300 hover:border-green-400"
        )}
      >
        {isDone && (
          <svg className="w-full h-full text-white p-0.5" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <Link href={`/tasks/${task.id}`} className={cn("flex-1 text-sm font-medium hover:underline min-w-0 truncate", isDone ? "line-through text-zinc-400" : "text-zinc-900")}>
        {task.title}
      </Link>

      <div className="flex items-center gap-2 flex-shrink-0 text-xs">
        {task.priority !== "normal" && (
          <span className={cn("px-1.5 py-0.5 rounded font-medium", priority.badge)}>{priority.label}</span>
        )}
        {task.due_date && (
          <span className={cn(
            "px-1.5 py-0.5 rounded font-medium",
            isOverdue  ? "bg-red-50 text-red-600"    :
            isDueToday ? "bg-amber-50 text-amber-700" :
                         "bg-zinc-50 text-zinc-500"
          )}>
            {isOverdue ? "Overdue" : isDueToday ? "Today" : format(parseISO(task.due_date), "MMM d")}
          </span>
        )}

        <div className="relative">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded font-medium hover:bg-zinc-100", col.color)}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full",
              task.status === "inbox" ? "bg-zinc-400" :
              task.status === "in_progress" ? "bg-blue-500" :
              task.status === "waiting" ? "bg-purple-500" :
              task.status === "blocked" ? "bg-red-500" : "bg-green-500"
            )} />
            {col.label}
          </button>
          {statusOpen && (
            <StatusDropdown
              current={task.status}
              onSelect={(s) => { setStatusOpen(false); startTransition(() => onStatusChange(task.id, s)); }}
              onClose={() => setStatusOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Task Dialog ────────────────────────────────────────────────────────

function CreateTaskDialog({
  defaultStatus,
  onCreated,
  onClose,
}: {
  defaultStatus: TaskStatus;
  onCreated: (task: Task) => void;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createTask(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.task) {
        onCreated(result.task);
      }
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
            <h2 className="text-sm font-semibold">New Task</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none">×</button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <input type="hidden" name="status" value={defaultStatus} />

            <div>
              <input
                name="title"
                placeholder="Task title…"
                required
                autoFocus
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-400"
              />
            </div>

            <div>
              <textarea
                name="description"
                placeholder="Description (optional)…"
                rows={2}
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-400 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Priority</label>
                <select name="priority" defaultValue="normal" className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Due date</label>
                <input type="date" name="due_date" className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancel</button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
              >
                {isPending ? "Creating…" : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
