// ─── Job status visual styles ──────────────────────────────────────────────────
// `inv_jobs.status` is a plain string column. Recognized values include:
//   planning · in_progress · staged · completed · archived
// Anything else falls back to a neutral zinc badge.

const STATUS_STYLES: Record<string, string> = {
  planning:    "bg-zinc-50 text-zinc-700 border-zinc-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  staged:      "bg-sky-50 text-sky-700 border-sky-200",
  completed:   "bg-green-50 text-green-700 border-green-200",
  archived:    "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const STATUS_LABELS: Record<string, string> = {
  planning:    "Planning",
  in_progress: "In Progress",
  staged:      "Staged",
  completed:   "Completed",
  archived:    "Archived",
};

export function JobStatusBadge({ status }: { status: string }) {
  const classes = STATUS_STYLES[status] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
  const label   = STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${classes}`}
    >
      {label}
    </span>
  );
}

export const JOB_STATUS_OPTIONS = [
  { value: "planning",    label: "Planning"    },
  { value: "in_progress", label: "In Progress" },
  { value: "staged",      label: "Staged"      },
  { value: "completed",   label: "Completed"   },
] as const;
