"use client";

import Link from "next/link";
import { useState, useTransition, useMemo, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { format, isToday, isPast, parseISO } from "date-fns";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { updateTaskStatus, createTask } from "@/app/(app)/tasks/actions";
import { TaskSlideOver } from "@/components/tasks/task-slide-over";
import type { Task, TaskStatus, TaskPriority, Profile, Project } from "@/lib/db-helpers.types";

// ─── Config ────────────────────────────────────────────────────────────────────

const COLUMNS: { status: Exclude<TaskStatus, "archived">; label: string; color: string; dot: string; headerBg: string }[] = [
  { status: "inbox",       label: "Inbox",       color: "text-ink-2",   dot: "bg-ink-4",   headerBg: "bg-sunken"   },
  { status: "in_progress", label: "In Progress", color: "text-info",   dot: "bg-info",   headerBg: "bg-info-tint"    },
  { status: "waiting",     label: "Waiting",     color: "text-info", dot: "bg-info", headerBg: "bg-info-tint"  },
  { status: "blocked",     label: "Blocked",     color: "text-danger",    dot: "bg-danger",    headerBg: "bg-danger-tint"     },
  { status: "done",        label: "Done",        color: "text-brand",  dot: "bg-brand",  headerBg: "bg-brand-tint"   },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; badge: string }> = {
  low:    { label: "Low",    badge: "bg-sunken text-ink-3"  },
  normal: { label: "Normal", badge: "bg-info-tint text-info"   },
  high:   { label: "High",   badge: "bg-warn-tint text-warn" },
  urgent: { label: "Urgent", badge: "bg-danger-tint text-danger"     },
};

type ScopeFilter = "mine" | "team" | "by_me";

// ─── Main Board ────────────────────────────────────────────────────────────────

export function TaskBoard({
  initialTasks,
  currentUserId,
  profiles,
  projects,
  assigneeMap,
}: {
  initialTasks: Task[];
  currentUserId: string;
  profiles: Pick<Profile, "id" | "full_name" | "email">[];
  projects: Pick<Project, "id" | "name" | "status">[];
  /** task.id → profile ids tagged on it. Primary first. */
  assigneeMap: Record<string, string[]>;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [scope, setScope] = useState<ScopeFilter>("mine");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("inbox");

  const isTaggedOnMe = (t: Task) =>
    t.assignee_id === currentUserId || (assigneeMap[t.id] ?? []).includes(currentUserId);

  // Scope filtering
  const scopedTasks = useMemo(() => {
    let filtered = tasks.filter((t) => t.status !== "archived");
    if (scope === "mine")   filtered = filtered.filter(isTaggedOnMe);
    if (scope === "team")   filtered = filtered.filter((t) => !isTaggedOnMe(t));
    if (scope === "by_me")  filtered = filtered.filter((t) => t.created_by_id === currentUserId && !isTaggedOnMe(t));
    if (priorityFilter !== "all") filtered = filtered.filter((t) => t.priority === priorityFilter);
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, scope, priorityFilter, currentUserId, assigneeMap]);

  const overdueCount = useMemo(() =>
    tasks.filter((t) => t.status !== "done" && t.status !== "archived" && isTaggedOnMe(t) && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, currentUserId, assigneeMap]
  );

  const openCount = useMemo(() =>
    tasks.filter((t) => t.status !== "done" && t.status !== "archived" && isTaggedOnMe(t)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, currentUserId, assigneeMap]
  );

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : t.completed_at } : t));
    updateTaskStatus(taskId, newStatus);
  };

  const handleComplete = (taskId: string) => handleStatusChange(taskId, "done");

  // Drag-and-drop handler — fires when a card is dropped on a column. If the
  // column changed, optimistically update local state then persist.
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as TaskStatus;
    const sourceStatus = result.source.droppableId as TaskStatus;
    if (sourceStatus === newStatus) return;
    handleStatusChange(taskId, newStatus);
  };

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

  // ── Slide-over panel: opens when ?taskId=... is in the URL. Clicking a
  //    card sets it; closing or routing away clears it. Permalink-friendly
  //    so deep-links from Slack / notifications still work.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedTaskId = searchParams.get("taskId");
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  const handleSelectTask = useCallback((taskId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("taskId", taskId);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 flex-shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            {openCount} open{overdueCount > 0 && <span className="text-danger font-medium"> · {overdueCount} overdue</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-md border border-line overflow-hidden text-sm">
            <button onClick={() => setView("kanban")} className={cn("px-3 py-1.5 font-medium transition-colors", view === "kanban" ? "bg-ink text-white" : "bg-white text-ink-2 hover:bg-hover")}>Board</button>
            <button onClick={() => setView("list")}   className={cn("px-3 py-1.5 font-medium border-l border-line transition-colors", view === "list"   ? "bg-ink text-white" : "bg-white text-ink-2 hover:bg-hover")}>List</button>
          </div>
          <Link href="/tasks/recurring" className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-hover hover:text-ink transition-colors">
            Recurring
          </Link>
          <button onClick={() => openCreate()} className="flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white hover:bg-ink-2">
            <span className="text-base leading-none">+</span> New Task
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap flex-shrink-0">
        {/* Scope */}
        <div className="flex rounded-md border border-line overflow-hidden text-xs font-medium">
          {([["mine", "My Tasks"], ["team", "Team"], ["by_me", "Assigned by Me"]] as [ScopeFilter, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setScope(val)} className={cn("px-3 py-1.5 border-r border-line last:border-r-0 transition-colors", scope === val ? "bg-ink text-white" : "bg-white text-ink-2 hover:bg-hover")}>
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
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-ink-3 border-line hover:border-line-strong"
              )}
            >
              {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <span className="text-xs text-ink-4">{scopedTasks.length} tasks</span>
      </div>

      {/* Board */}
      {view === "kanban" ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <KanbanView tasks={scopedTasks} profilesMap={profilesMap} projectsMap={projectsMap} assigneeMap={assigneeMap} currentUserId={currentUserId} onStatusChange={handleStatusChange} onComplete={handleComplete} onAddTask={openCreate} onSelectTask={handleSelectTask} />
        </DragDropContext>
      ) : (
        <ListView tasks={scopedTasks} profilesMap={profilesMap} projectsMap={projectsMap} assigneeMap={assigneeMap} currentUserId={currentUserId} onStatusChange={handleStatusChange} onComplete={handleComplete} onSelectTask={handleSelectTask} />
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

      {selectedTask && (
        <TaskSlideOver
          task={selectedTask}
          allProfiles={profiles}
          initialAssigneeIds={assigneeMap[selectedTask.id] ?? (selectedTask.assignee_id ? [selectedTask.assignee_id] : [])}
        />
      )}
    </div>
  );
}

// ─── Shared types for sub-components ─────────────────────────────────────────

type SharedProps = {
  profilesMap: Record<string, Pick<Profile, "id" | "full_name" | "email">>;
  projectsMap: Record<string, Pick<Project, "id" | "name" | "status">>;
  assigneeMap: Record<string, string[]>;
  currentUserId: string;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onComplete: (id: string) => void;
  onSelectTask: (id: string) => void;
};

type BoardProps = SharedProps & { tasks: Task[] };

// ─── Kanban View ───────────────────────────────────────────────────────────────

function KanbanView({ tasks, profilesMap, projectsMap, assigneeMap, currentUserId, onStatusChange, onComplete, onAddTask, onSelectTask }: BoardProps & { onAddTask: (s: TaskStatus) => void; }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 flex-1" style={{ minHeight: 0 }}>
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="flex flex-col w-72 flex-shrink-0 rounded-xl border border-line bg-hover overflow-hidden">
            <div className={cn("flex items-center justify-between px-3 py-2.5 border-b border-line", col.headerBg)}>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-semibold", col.color)}>{col.label}</span>
                <span className="text-xs text-ink-4 font-medium bg-white border border-line rounded-full px-1.5 py-0.5 leading-none">{colTasks.length}</span>
              </div>
              <button onClick={() => onAddTask(col.status)} className="text-ink-4 hover:text-ink-2 text-lg leading-none font-light" title={`Add to ${col.label}`}>+</button>
            </div>
            <Droppable droppableId={col.status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex-1 overflow-y-auto p-2 space-y-2 transition-colors",
                    snapshot.isDraggingOver ? "bg-info-tint/60" : ""
                  )}
                >
                  {colTasks.length === 0 ? (
                    <div className="text-center py-8 text-xs text-ink-4">
                      {snapshot.isDraggingOver ? "Drop here" : col.status === "done" ? "Completed tasks appear here" : "No tasks"}
                    </div>
                  ) : (
                    colTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={cn(
                              "transition-shadow",
                              dragSnapshot.isDragging ? "shadow-xl rotate-1" : ""
                            )}
                            style={dragProvided.draggableProps.style}
                          >
                            <TaskCard
                              task={task}
                              profilesMap={profilesMap}
                              projectsMap={projectsMap}
                              assigneeMap={assigneeMap}
                              currentUserId={currentUserId}
                              onStatusChange={onStatusChange}
                              onComplete={onComplete}
                              onSelectTask={onSelectTask}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        );
      })}
    </div>
  );
}

// ─── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({ task, profilesMap, projectsMap, assigneeMap, currentUserId, onStatusChange, onComplete, onSelectTask }: SharedProps & { task: Task }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [, startTransition] = useTransition();
  const isDone = task.status === "done";
  const isOverdue  = task.due_date && !isDone && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const isDueToday = task.due_date && !isDone && isToday(parseISO(task.due_date));
  const priority = PRIORITY_CONFIG[task.priority];
  // Multi-assignee: prefer the full set from the join table; fall back to
  // the legacy single assignee_id if for some reason the task isn't in the map.
  const assigneeIds = assigneeMap[task.id] ?? (task.assignee_id ? [task.assignee_id] : []);
  const assignees = assigneeIds.map((id) => profilesMap[id]).filter(Boolean);
  const project = task.project_id ? projectsMap[task.project_id] : null;
  const isTaggedOnMe = assigneeIds.includes(currentUserId);

  return (
    <div className={cn("bg-white rounded-lg border p-3 group hover:shadow-sm transition-shadow", isDone ? "border-line opacity-60" : "border-line", task.status === "blocked" ? "border-danger/30 bg-danger-tint/30" : "")}>
      <div className="flex items-start gap-2">
        <button
          onClick={() => !isDone && startTransition(() => onComplete(task.id))}
          className={cn("mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors", isDone ? "border-brand bg-brand" : "border-line-strong hover:border-brand")}
          title={isDone ? "Completed" : "Mark done"}
        >
          {isDone && <svg className="w-full h-full text-white p-0.5" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title opens the slide-over via search param; cmd-click (or
              middle-click) on the wrapper link still opens the full page. */}
          <button
            type="button"
            onClick={() => onSelectTask(task.id)}
            className={cn(
              "text-left text-sm font-medium leading-snug block hover:underline cursor-pointer w-full",
              isDone ? "line-through text-ink-4" : "text-ink",
            )}
          >
            {task.title}
          </button>

          {project && (
            <Link href={`/jobs/${project.id}`} className="text-xs text-ink-4 hover:text-ink-2 block mt-0.5 truncate">
              💼 {project.name}
            </Link>
          )}

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {task.priority !== "normal" && <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", priority.badge)}>{priority.label}</span>}
            {task.due_date && (
              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", isOverdue ? "bg-danger-tint text-danger" : isDueToday ? "bg-warn-tint text-warn" : "bg-hover text-ink-3")}>
                {isOverdue ? "Overdue" : isDueToday ? "Today" : format(parseISO(task.due_date), "MMM d")}
              </span>
            )}
            {assignees.length > 0 && !(isTaggedOnMe && assignees.length === 1) && (
              <AvatarStack
                assignees={assignees}
                currentUserId={currentUserId}
              />
            )}
            {task.status === "blocked" && task.blocked_reason && (
              <span className="text-xs text-danger truncate max-w-[120px]" title={task.blocked_reason}>🚫 {task.blocked_reason}</span>
            )}
          </div>
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className={cn("w-2 h-2 rounded-full mt-1 transition-transform hover:scale-125 cursor-pointer", COLUMNS.find((c) => c.status === task.status)?.dot ?? "bg-ink-4")}
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
      <div className="absolute right-0 top-4 z-20 bg-white border border-line rounded-lg shadow-lg py-1 min-w-[140px]">
        {COLUMNS.map((col) => (
          <button key={col.status} onClick={() => onSelect(col.status)} className={cn("w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-2 hover:bg-hover transition-colors", current === col.status ? "text-ink" : "text-ink-2")}>
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", col.dot)} />
            {col.label}
            {current === col.status && <span className="ml-auto text-ink-4">✓</span>}
          </button>
        ))}
      </div>
    </>
  );
}

// ─── Assignee Avatars ────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-info-tint text-info",
  "bg-info-tint text-info",
  "bg-warn-tint text-warn",
  "bg-brand-tint text-brand",
  "bg-info-tint text-info",
  "bg-info-tint text-info",
  "bg-brand-tint text-brand",
  "bg-danger-tint text-danger",
];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initialOf(p: { full_name: string | null; email: string }): string {
  const n = (p.full_name ?? p.email).trim();
  return n[0]?.toUpperCase() ?? "?";
}

function nameOf(p: { full_name: string | null; email: string }): string {
  return p.full_name ?? p.email.split("@")[0];
}

function Avatar({
  profile,
  size = "sm",
  ring = false,
}: {
  profile: Pick<Profile, "id" | "full_name" | "email">;
  size?: "xs" | "sm" | "md";
  ring?: boolean;
}) {
  const dims = size === "xs" ? "w-4 h-4 text-[9px]" : size === "md" ? "w-7 h-7 text-xs" : "w-5 h-5 text-[10px]";
  return (
    <span
      title={nameOf(profile)}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold flex-shrink-0",
        dims,
        colorFor(profile.id),
        ring && "ring-2 ring-white",
      )}
    >
      {initialOf(profile)}
    </span>
  );
}

function AvatarStack({
  assignees,
  currentUserId,
  max = 3,
}: {
  assignees: Pick<Profile, "id" | "full_name" | "email">[];
  currentUserId: string;
  max?: number;
}) {
  // Put the current user last so the visible labels favor showing teammates.
  const sorted = [...assignees].sort((a, b) => {
    if (a.id === currentUserId) return 1;
    if (b.id === currentUserId) return -1;
    return 0;
  });
  const shown = sorted.slice(0, max);
  const overflow = sorted.length - shown.length;
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((p) => (
        <Avatar key={p.id} profile={p} ring />
      ))}
      {overflow > 0 && (
        <span
          title={sorted.slice(max).map(nameOf).join(", ")}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-line text-[10px] font-semibold text-ink-2 ring-2 ring-white"
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}

// ─── List View ─────────────────────────────────────────────────────────────────

function ListView({ tasks, profilesMap, projectsMap, assigneeMap, currentUserId, onStatusChange, onComplete, onSelectTask }: BoardProps) {
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

  if (sorted.length === 0) return <div className="text-center py-16 text-sm text-ink-4">No tasks match your filters</div>;

  return (
    <div className="space-y-1">
      {sorted.map((task) => <ListRow key={task.id} task={task} profilesMap={profilesMap} projectsMap={projectsMap} assigneeMap={assigneeMap} currentUserId={currentUserId} onStatusChange={onStatusChange} onComplete={onComplete} onSelectTask={onSelectTask} />)}
    </div>
  );
}

function ListRow({ task, profilesMap, projectsMap, assigneeMap, currentUserId, onStatusChange, onComplete, onSelectTask }: SharedProps & { task: Task }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [, startTransition] = useTransition();
  const isDone = task.status === "done";
  const isOverdue  = task.due_date && !isDone && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const isDueToday = task.due_date && !isDone && isToday(parseISO(task.due_date));
  const col = COLUMNS.find((c) => c.status === task.status)!;
  const assigneeIds = assigneeMap[task.id] ?? (task.assignee_id ? [task.assignee_id] : []);
  const assignees = assigneeIds.map((id) => profilesMap[id]).filter(Boolean);
  const project = task.project_id ? projectsMap[task.project_id] : null;
  const isTaggedOnMe = assigneeIds.includes(currentUserId);

  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white hover:shadow-sm transition-shadow group", isDone ? "border-line opacity-60" : "border-line")}>
      <button onClick={() => !isDone && startTransition(() => onComplete(task.id))} className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors", isDone ? "border-brand bg-brand" : "border-line-strong hover:border-brand")}>
        {isDone && <svg className="w-full h-full text-white p-0.5" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </button>

      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onSelectTask(task.id)}
          className={cn(
            "text-left text-sm font-medium hover:underline truncate block w-full",
            isDone ? "line-through text-ink-4" : "text-ink",
          )}
        >
          {task.title}
        </button>
        {project && <span className="text-xs text-ink-4 truncate">{project.name}</span>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 text-xs">
        {assignees.length > 0 && !(isTaggedOnMe && assignees.length === 1) && (
          <AvatarStack assignees={assignees} currentUserId={currentUserId} />
        )}
        {task.priority !== "normal" && <span className={cn("px-1.5 py-0.5 rounded font-medium", PRIORITY_CONFIG[task.priority].badge)}>{PRIORITY_CONFIG[task.priority].label}</span>}
        {task.due_date && (
          <span className={cn("px-1.5 py-0.5 rounded font-medium", isOverdue ? "bg-danger-tint text-danger" : isDueToday ? "bg-warn-tint text-warn" : "bg-hover text-ink-3")}>
            {isOverdue ? "Overdue" : isDueToday ? "Today" : format(parseISO(task.due_date), "MMM d")}
          </span>
        )}
        <div className="relative">
          <button onClick={() => setStatusOpen(!statusOpen)} className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded font-medium hover:bg-sunken", col.color)}>
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
  const [assigneeIds, setAssigneeIds] = useState<string[]>([currentUserId]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // formData already includes all assignee_ids from the checkboxes, but
    // browsers don't submit unchecked items — we double-check we have at
    // least one tag before sending.
    const tags = formData.getAll("assignee_ids");
    if (tags.length === 0) {
      setError("Tag at least one person.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createTask(formData);
      if (result.error) setError(result.error);
      else if (result.task) onCreated(result.task);
    });
  };

  // 16px-rem font on inputs keeps iOS Safari from auto-zooming on focus.
  const fieldCls = "w-full text-base border border-line-strong rounded-xl h-12 px-3 focus:outline-none focus:ring-2 focus:ring-brand focus:border-ink bg-white";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div className="fixed inset-0 z-40 flex items-center justify-center sm:p-4">
        <div className="bg-white sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
            <h2 className="text-base font-semibold">New Task</h2>
            <button onClick={onClose} aria-label="Close" className="text-ink-4 hover:text-ink-2 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-sunken">
              <span className="text-xl leading-none">×</span>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <input type="hidden" name="status" value={defaultStatus} />

            <input name="title" placeholder="Task title…" required autoFocus className={fieldCls} />

            <textarea name="description" placeholder="Description (optional)…" rows={2} className="w-full text-base border border-line-strong rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-ink placeholder:text-ink-4 resize-none" />

            {/* Tag people — multi-select */}
            <div>
              <label className="flex items-baseline justify-between text-xs font-semibold text-ink-2 mb-1.5">
                <span>Tag people *</span>
                <span className="text-[10px] font-normal text-ink-4">{assigneeIds.length} tagged</span>
              </label>
              <AssigneePicker
                profiles={profiles}
                selected={assigneeIds}
                onChange={setAssigneeIds}
                currentUserId={currentUserId}
              />
              {/* Hidden inputs so formData.getAll("assignee_ids") works. */}
              {assigneeIds.map((id) => (
                <input key={id} type="hidden" name="assignee_ids" value={id} />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">Priority</label>
                <select name="priority" defaultValue="normal" className={fieldCls}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">Due date</label>
                <input type="date" name="due_date" className={fieldCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1.5">Job <span className="font-normal text-ink-4">(optional)</span></label>
              <select name="project_id" defaultValue="" className={fieldCls}>
                <option value="">No job</option>
                {projects.filter((p) => p.status !== "complete" && p.status !== "cancelled").map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-line shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={onClose} className="h-11 px-4 text-sm font-medium text-ink-2 hover:text-ink rounded-lg">Cancel</button>
            <button type="submit" disabled={isPending} className="h-11 px-5 text-sm font-semibold bg-ink text-white rounded-xl hover:bg-ink active:bg-ink-2 disabled:opacity-50">
              {isPending ? "Creating…" : "Create Task"}
            </button>
          </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Assignee Multi-Picker ────────────────────────────────────────────────────

function AssigneePicker({
  profiles,
  selected,
  onChange,
  currentUserId,
}: {
  profiles: Pick<Profile, "id" | "full_name" | "email">[];
  selected: string[];
  onChange: (ids: string[]) => void;
  currentUserId: string;
}) {
  const [q, setQ] = useState("");
  const selectedSet = new Set(selected);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter((p) =>
      (p.full_name ?? "").toLowerCase().includes(term) ||
      p.email.toLowerCase().includes(term),
    );
  }, [profiles, q]);

  return (
    <div className="rounded-xl border border-line-strong bg-white">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5 pb-1.5">
          {selected.map((id) => {
            const p = profiles.find((x) => x.id === id);
            if (!p) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-sunken hover:bg-line pl-1 pr-2 h-7 text-xs font-medium text-ink"
              >
                <Avatar profile={p} size="xs" />
                <span>{nameOf(p)}{p.id === currentUserId ? " (me)" : ""}</span>
                <span className="text-ink-4">×</span>
              </button>
            );
          })}
        </div>
      )}
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search teammates…"
        className="w-full text-base px-3 h-11 border-y border-line focus:outline-none focus:border-line-strong"
      />
      <ul className="max-h-44 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-xs text-ink-4">No matches</li>
        )}
        {filtered.map((p) => {
          const isOn = selectedSet.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 h-11 px-3 text-left transition-colors",
                  isOn ? "bg-hover text-ink" : "text-ink-2 hover:bg-hover",
                )}
              >
                <Avatar profile={p} />
                <span className="flex-1 text-sm truncate">{nameOf(p)}{p.id === currentUserId ? " (me)" : ""}</span>
                <span className={cn("w-5 h-5 rounded border flex items-center justify-center", isOn ? "bg-ink border-ink text-white" : "border-line-strong")}>
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
    </div>
  );
}
