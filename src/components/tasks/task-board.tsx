"use client";

import Link from "next/link";
import { useState, useTransition, useMemo } from "react";
import { format, isToday, isPast, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { updateTaskStatus, completeTask, createTask } from "@/app/(app)/tasks/actions";
import type { Task, TaskStatus, TaskPriority, Profile, Project } from "@/lib/database.types";

// ─── Config ────────────────────────────────────────────────────────────────────

const COLUMNS: { status: Exclude<TaskStatus, "archived">; label: string; color: string; dot: string; headerBg: string }[] = [
  { status: "inbox",       label: "Inbox",       color: "text-zinc-600",   dot: "bg-zinc-400",   headerBg: "bg-zinc-100"   },
  { status: "in_progress", label: "In Progress", color: "text-blue-700",   dot: "bg-blue-500",   headerBg: "bg-blue-50"    },
  { status: "waiting",     label: "Waiting",     color: "text-purple-700", dot: "bg-purple-500", headerBg: "bg-purple-50"  },
  { status: "blocked",     label: "Blocked",     color: "text-red-700",    dot: "bg-red-500",    headerBg: "bg-red-50"     },
  { status: "done",        label: "Done",        color: "text-green-700",  dot: "bg-green-500",  headerBg: "bg-green-50"   },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; badge: string }> = {
  low:    { label: "Low",    badge: "bg-zinc-100 text-zinc-500"  },
  normal: { label: "Normal", badge: "bg-blue-50 text-blue-600"   },
  high:   { label: "High",   badge: "bg-amber-50 text-amber-700" },
  urgent: { label: "Urgent", badge: "bg-red-50 text-red-700"     },
};

type ScopeFilter = "mine" | "team" | "by_me";

// ─── Main Board ────────────────────────────────────────────────────────────────

export function TaskBoard({
  initialTasks,
  currentUserId,
  profiles,
  projects,
}: {
  initialTasks: Task[];
  currentUserId: string;
  profiles: Pick<Profile, "id" | "full_name" | "email">[];
  projects: Pick<Project, "id" | "name" | "status">[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [scope, setScope] = useState<ScopeFilter>("mine");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("inbox");

  // Scope filtering
  const scopedTasks = useMemo(() => {
    let filtered = tasks.filter((t) => t.status !== "archived");
    if (scope === "mine")   filtered = filtered.filter((t) => t.assignee_id === currentUserId);
    if (scope === "team")   filtered = filtered.filter((t) => t.assignee_id !== currentUserId);
    if (scope === "by_me")  filtered = filtered.filter((t) => t.created_by_id === currentUserId && t.assignee_id !== currentUserId);
    if (priorityFilter !== "all") filtered = filtered.filter((t) => t.priority === priorityFilter);
    return filtered;
  }, [tasks, scope, priorityFilter, currentUserId]);

  const overdueCount = useMemo(() =>
    tasks.filter((t) => t.status !== "done" && t.status !== "archived" && t.assignee_id === currentUserId && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))).length,
    [tasks, currentUserId]
  );

  const openCount = useMemo(() =>
    tasks.filter((t) => t.status !== "done" && t.status !== "archived" && t.assignee_id === currentUserId).length,
    [tasks, currentUserId]
  );

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : t.completed_at } : t));
    updateTaskStatus(taskId, newStatus);
  };

  const handleComplete = (taskId: string) => handleStatusChange(taskId, "done");

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setShowCreate(false);
  };

  const openCreate = (status: TaskStatus = "inbox") => {
    setCreateStatus(status);
    setShowCreate(true);
  };

  const profilesMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);
  const projectsMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 flex-shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {openCount} open{overdueCount > 0 && <span className="text-red-600 font-medium"> · {overdueCount} overdue</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-md border border-zinc-200 overflow-hidden text-sm">
            <button onClick={() => setView("kanban")} className={cn("px-3 py-1.5 font-medium transition-colors", view === "kanban" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50")}>Board</button>
            <button onClick={() => setView("list")}   className={cn("px-3 py-1.5 font-medium border-l border-zinc-200 transition-colors", view === "list"   ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50")}>List</button>
          </div>
          <button onClick={() => openCreate()} className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
            <span className="text-base leading-none">+</span> New Task
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap flex-shrink-0">
        {/* Scope */}
        <div className="flex rounded-md border border-zinc-200 overflow-hidden text-xs font-medium">
          {([["mine", "My Tasks"], ["team", "Team"], ["by_me", "Assigned by Me"]] as [ScopeFilter, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setScope(val)} className={cn("px-3 py-1.5 border-r border-zinc-200 last:border-r-0 transition-colors", scope === val ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50")}>
              {label}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <div className="flex items-center gap-1">
          {(["all", "urgent", "high", "normal", "low"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-full font-medium border transition-colors",
                priorityFilter === p
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
              )}
            >
              {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <span className="text-xs text-zinc-400">{scopedTasks.length} tasks</span>
      </div>

      {/* Board */}
      {view === "kanban" ? (
        <KanbanView tasks={scopedTasks} profilesMap={profilesMap} projectsMap={projectsMap} currentUserId={currentUserId} onStatusChange={handleStatusChange} onComplete={handleComplete} onAddTask={openCreate} />
      ) : (
        <ListView tasks={scopedTasks} profilesMap={profilesMap} projectsMap={projectsMap} currentUserId={currentUserId} onStatusChange={handleStatusChange} onComplete={handleComplete} />
      )}

      {showCreate && (
        <CreateTaskDialog
          defaultStatus={createStatus}
          currentUserId={currentUserId}
          profiles={profiles}
          projects={projects}
          onCreated={handleTaskCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ─── Shared types for sub-components ─────────────────────────────────────────

type SharedProps = {
  profilesMap: Record<string, Pick<Profile, "id" | "full_name" | "email">>;
  projectsMap: Record<string, Pick<Project, "id" | "name" | "status">>;
  currentUserId: string;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onComplete: (id: string) => void;
};

type BoardProps = SharedProps & { tasks: Task[] };

// ─── Kanban View ───────────────────────────────────────────────────────────────

function KanbanView({ tasks, profilesMap, projectsMap, currentUserId, onStatusChange, onComplete, onAddTask }: BoardProps & { onAddTask: (s: TaskStatus) => void; }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 flex-1" style={{ minHeight: 0 }}>
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="flex flex-col w-72 flex-shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden">
            <div className={cn("flex items-center justify-between px-3 py-2.5 border-b border-zinc-200", col.headerBg)}>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-semibold", col.color)}>{col.label}</span>
                <span className="text-xs text-zinc-400 font-medium bg-white border border-zinc-200 rounded-full px-1.5 py-0.5 leading-none">{colTasks.length}</span>
              </div>
              <button onClick={() => onAddTask(col.status)} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none font-light" title={`Add to ${col.label}`}>+</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {colTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-400">{col.status === "done" ? "Completed tasks appear here" : "No tasks"}</div>
              ) : (
                colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} profilesMap={profilesMap} projectsMap={projectsMap} currentUserId={currentUserId} onStatusChange={onStatusChange} onComplete={onComplete} />
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

function TaskCard({ task, profilesMap, projectsMap, currentUserId, onStatusChange, onComplete }: SharedProps & { task: Task }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [, startTransition] = useTransition();
  const isDone = task.status === "done";
  const isOverdue  = task.due_date && !isDone && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const isDueToday = task.due_date && !isDone && isToday(parseISO(task.due_date));
  const priority = PRIORITY_CONFIG[task.priority];
  const assignee = profilesMap[task.assignee_id];
  const project = task.project_id ? projectsMap[task.project_id] : null;
  const isOwnTask = task.assignee_id === currentUserId;

  return (
    <div className={cn("bg-white rounded-lg border p-3 group hover:shadow-sm transition-shadow", isDone ? "border-zinc-100 opacity-60" : "border-zinc-200", task.status === "blocked" ? "border-red-200 bg-red-50/30" : "")}>
      <div className="flex items-start gap-2">
        <button
          onClick={() => !isDone && startTransition(() => onComplete(task.id))}
          className={cn("mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors", isDone ? "border-green-400 bg-green-400" : "border-zinc-300 hover:border-green-400")}
          title={isDone ? "Completed" : "Mark done"}
        >
          {isDone && <svg className="w-full h-full text-white p-0.5" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>

        <div className="flex-1 min-w-0">
          <Link href={`/tasks/${task.id}`} className={cn("text-sm font-medium leading-snug block hover:underline", isDone ? "line-through text-zinc-400" : "text-zinc-900")}>
            {task.title}
          </Link>

          {project && (
            <Link href={`/projects/${project.id}`} className="text-xs text-zinc-400 hover:text-zinc-600 block mt-0.5 truncate">
              📁 {project.name}
            </Link>
          )}

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {task.priority !== "normal" && <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", priority.badge)}>{priority.label}</span>}
            {task.due_date && (
              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", isOverdue ? "bg-red-50 text-red-600" : isDueToday ? "bg-amber-50 text-amber-700" : "bg-zinc-50 text-zinc-500")}>
                {isOverdue ? "Overdue" : isDueToday ? "Today" : format(parseISO(task.due_date), "MMM d")}
              </span>
            )}
            {!isOwnTask && assignee && (
              <span className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-medium">
                {assignee.full_name ?? assignee.email.split("@")[0]}
              </span>
            )}
            {task.status === "blocked" && task.blocked_reason && (
              <span className="text-xs text-red-500 truncate max-w-[120px]" title={task.blocked_reason}>🚫 {task.blocked_reason}</span>
            )}
          </div>
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className={cn("w-2 h-2 rounded-full mt-1 transition-transform hover:scale-125 cursor-pointer", COLUMNS.find((c) => c.status === task.status)?.dot ?? "bg-zinc-400")}
            title="Change status"
          />
          {statusOpen && <StatusDropdown current={task.status} onSelect={(s) => { setStatusOpen(false); startTransition(() => onStatusChange(task.id, s)); }} onClose={() => setStatusOpen(false)} />}
        </div>
      </div>
    </div>
  );
}

// ─── Status Dropdown ──────────────────────────────────────────────────────────

function StatusDropdown({ current, onSelect, onClose }: { current: TaskStatus; onSelect: (s: TaskStatus) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-4 z-20 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 min-w-[140px]">
        {COLUMNS.map((col) => (
          <button key={col.status} onClick={() => onSelect(col.status)} className={cn("w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-2 hover:bg-zinc-50 transition-colors", current === col.status ? "text-zinc-900" : "text-zinc-600")}>
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", col.dot)} />
            {col.label}
            {current === col.status && <span className="ml-auto text-zinc-400">✓</span>}
          </button>
        ))}
      </div>
    </>
  );
}

// ─── Assignee Avatar ──────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  return (
    <span className="inline-flex w-5 h-5 rounded-full bg-zinc-200 items-center justify-center text-[10px] font-semibold text-zinc-600 flex-shrink-0">
      {name[0].toUpperCase()}
    </span>
  );
}

// ─── List View ─────────────────────────────────────────────────────────────────

function ListView({ tasks, profilesMap, projectsMap, currentUserId, onStatusChange, onComplete }: BoardProps) {
  const sorted = [...tasks].sort((a, b) => {
    const pw = { urgent: 0, high: 1, normal: 2, low: 3 };
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    const pa = pw[a.priority], pb = pw[b.priority];
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  if (sorted.length === 0) return <div className="text-center py-16 text-sm text-zinc-400">No tasks match your filters</div>;

  return (
    <div className="space-y-1">
      {sorted.map((task) => <ListRow key={task.id} task={task} profilesMap={profilesMap} projectsMap={projectsMap} currentUserId={currentUserId} onStatusChange={onStatusChange} onComplete={onComplete} />)}
    </div>
  );
}

function ListRow({ task, profilesMap, projectsMap, currentUserId, onStatusChange, onComplete }: SharedProps & { task: Task }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [, startTransition] = useTransition();
  const isDone = task.status === "done";
  const isOverdue  = task.due_date && !isDone && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const isDueToday = task.due_date && !isDone && isToday(parseISO(task.due_date));
  const col = COLUMNS.find((c) => c.status === task.status)!;
  const assignee = profilesMap[task.assignee_id];
  const project = task.project_id ? projectsMap[task.project_id] : null;
  const isOwnTask = task.assignee_id === currentUserId;

  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white hover:shadow-sm transition-shadow group", isDone ? "border-zinc-100 opacity-60" : "border-zinc-200")}>
      <button onClick={() => !isDone && startTransition(() => onComplete(task.id))} className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors", isDone ? "border-green-400 bg-green-400" : "border-zinc-300 hover:border-green-400")}>
        {isDone && <svg className="w-full h-full text-white p-0.5" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </button>

      <div className="flex-1 min-w-0">
        <Link href={`/tasks/${task.id}`} className={cn("text-sm font-medium hover:underline truncate block", isDone ? "line-through text-zinc-400" : "text-zinc-900")}>{task.title}</Link>
        {project && <span className="text-xs text-zinc-400 truncate">{project.name}</span>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 text-xs">
        {!isOwnTask && assignee && <Avatar name={assignee.full_name ?? assignee.email} />}
        {task.priority !== "normal" && <span className={cn("px-1.5 py-0.5 rounded font-medium", PRIORITY_CONFIG[task.priority].badge)}>{PRIORITY_CONFIG[task.priority].label}</span>}
        {task.due_date && (
          <span className={cn("px-1.5 py-0.5 rounded font-medium", isOverdue ? "bg-red-50 text-red-600" : isDueToday ? "bg-amber-50 text-amber-700" : "bg-zinc-50 text-zinc-500")}>
            {isOverdue ? "Overdue" : isDueToday ? "Today" : format(parseISO(task.due_date), "MMM d")}
          </span>
        )}
        <div className="relative">
          <button onClick={() => setStatusOpen(!statusOpen)} className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded font-medium hover:bg-zinc-100", col.color)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", col.dot)} />{col.label}
          </button>
          {statusOpen && <StatusDropdown current={task.status} onSelect={(s) => { setStatusOpen(false); startTransition(() => onStatusChange(task.id, s)); }} onClose={() => setStatusOpen(false)} />}
        </div>
      </div>
    </div>
  );
}

// ─── Create Task Dialog ────────────────────────────────────────────────────────

function CreateTaskDialog({
  defaultStatus, currentUserId, profiles, projects, onCreated, onClose,
}: {
  defaultStatus: TaskStatus;
  currentUserId: string;
  profiles: Pick<Profile, "id" | "full_name" | "email">[];
  projects: Pick<Project, "id" | "name" | "status">[];
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
      if (result.error) setError(result.error);
      else if (result.task) onCreated(result.task);
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
            <h2 className="text-sm font-semibold">New Task</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">×</button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <input type="hidden" name="status" value={defaultStatus} />

            <input name="title" placeholder="Task title…" required autoFocus className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-400" />

            <textarea name="description" placeholder="Description (optional)…" rows={2} className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-400 resize-none" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Assign to</label>
                <select name="assignee_id" defaultValue={currentUserId} className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white">
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name ?? p.email.split("@")[0]}{p.id === currentUserId ? " (me)" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Priority</label>
                <select name="priority" defaultValue="normal" className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Project (optional)</label>
                <select name="project_id" className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white">
                  <option value="">No project</option>
                  {projects.filter((p) => p.status !== "complete" && p.status !== "cancelled").map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
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
              <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50">
                {isPending ? "Creating…" : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
