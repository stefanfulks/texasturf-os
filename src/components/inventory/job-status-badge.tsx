// ─── Job status visual styles ──────────────────────────────────────────────────
// `inv_jobs.status` is a plain string column. Recognized values include:
//   planning · in_progress · staged · completed · archived
// Anything else falls back to a neutral zinc badge.

const STATUS_STYLES: Record<string, string> = {
  planning:    "bg-hover text-ink-2 border-line",
  in_progress: "bg-info-tint text-info border-info/30",
  staged:      "bg-info-tint text-info border-info/30",
  completed:   "bg-brand-tint text-brand border-brand/30",
  archived:    "bg-sunken text-ink-3 border-line",
};

const STATUS_LABELS: Record<string, string> = {
  planning:    "Planning",
  in_progress: "In Progress",
  staged:      "Staged",
  completed:   "Completed",
  archived:    "Archived",
};

export function JobStatusBadge({ status }: { status: string }) {
  const classes = STATUS_STYLES[status] ?? "bg-hover text-ink-2 border-line";
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
