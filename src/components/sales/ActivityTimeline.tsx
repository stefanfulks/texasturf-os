import {
  ArrowRightLeft,
  CheckSquare,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import type { DealActivity } from "@/lib/sales/types";
import { daysBetween, today } from "@/lib/sales/dates";
import { shortDate } from "@/lib/sales/format";

const ICONS: Record<DealActivity["kind"], LucideIcon> = {
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  site_visit: MapPin,
  note: StickyNote,
  stage_change: ArrowRightLeft,
  task: CheckSquare,
};

const KIND_LABELS: Record<DealActivity["kind"], string> = {
  call: "Call",
  email: "Email",
  sms: "Text",
  site_visit: "Site visit",
  note: "Note",
  stage_change: "Stage change",
  task: "Task",
};

function relDays(iso: string, now: string): string {
  const d = daysBetween(iso, now);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

export function ActivityTimeline({
  activities,
  ownerNames = {},
}: {
  activities: DealActivity[];
  ownerNames?: Record<string, string>;
}) {
  const now = today();
  const sorted = [...activities].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );

  if (!sorted.length) {
    return (
      <div className="px-1 py-6 text-center text-[13px] text-ink-3">
        No activity yet.
      </div>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-line pl-0">
      {sorted.map((a) => {
        const Icon = ICONS[a.kind] ?? StickyNote;
        const author = (a.created_by && ownerNames[a.created_by]) || "System";
        return (
          <li key={a.id} className="relative flex gap-3 py-2.5 pl-5">
            <span className="absolute -left-[9px] top-3 flex size-[18px] items-center justify-center rounded-full border border-line bg-surface">
              <Icon className="size-2.5 text-ink-3" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] leading-snug text-ink">
                {a.body || KIND_LABELS[a.kind]}
              </div>
              <div className="eyebrow mt-0.5 text-[9px]">
                {author} · {shortDate(a.occurred_at)} · {relDays(a.occurred_at, now)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
