import type { RollStatus } from "@/lib/db-helpers.types";

const STATUS_STYLES: Record<RollStatus, string> = {
  available:  "bg-brand-tint text-brand border-brand/30",
  planned:    "bg-info-tint text-info border-info/30",
  allocated:  "bg-info-tint text-info border-info/30",
  staged:     "bg-info-tint text-info border-info/30",
  dispatched: "bg-warn-tint text-warn border-warn/30",
  consumed:   "bg-hover text-ink-2 border-line",
  damaged:    "bg-danger-tint text-danger border-danger/30",
  returned:   "bg-warn-tint text-warn border-warn/30",
};

const STATUS_LABELS: Record<RollStatus, string> = {
  available:  "Available",
  planned:    "Planned",
  allocated:  "Allocated",
  staged:     "Staged",
  dispatched: "Dispatched",
  consumed:   "Consumed",
  damaged:    "Damaged",
  returned:   "Returned",
};

export function RollStatusBadge({ status }: { status: RollStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
