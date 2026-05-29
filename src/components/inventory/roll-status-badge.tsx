import type { RollStatus } from "@/lib/database.types";

const STATUS_STYLES: Record<RollStatus, string> = {
  available:  "bg-green-50 text-green-700 border-green-200",
  planned:    "bg-purple-50 text-purple-700 border-purple-200",
  allocated:  "bg-blue-50 text-blue-700 border-blue-200",
  staged:     "bg-sky-50 text-sky-700 border-sky-200",
  dispatched: "bg-amber-50 text-amber-800 border-amber-200",
  consumed:   "bg-zinc-50 text-zinc-600 border-zinc-200",
  damaged:    "bg-red-50 text-red-700 border-red-200",
  returned:   "bg-orange-50 text-orange-700 border-orange-200",
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
