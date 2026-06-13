"use client";

import { useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toggleRecurringRule } from "./actions";
import type { RecurringRule, RecurrenceFreq } from "@/lib/db-helpers.types";

const FREQ_LABELS: Record<RecurrenceFreq, string> = {
  daily:    "Daily",
  weekly:   "Weekly",
  biweekly: "Every 2 weeks",
  monthly:  "Monthly",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function freqLabel(rule: RecurringRule): string {
  const base = FREQ_LABELS[rule.freq as RecurrenceFreq];
  if ((rule.freq === "weekly" || rule.freq === "biweekly") && rule.day_of_week !== null) {
    return `${base} on ${DAYS[rule.day_of_week]}`;
  }
  if (rule.freq === "monthly" && rule.day_of_month !== null) {
    return `${base} on the ${rule.day_of_month}th`;
  }
  return base;
}

const PRIORITY_DOT: Record<string, string> = {
  low:    "bg-line-strong",
  normal: "bg-info",
  high:   "bg-warn",
  urgent: "bg-danger",
};

export function RuleRow({
  rule,
  assigneeName,
}: {
  rule: RecurringRule;
  assigneeName: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div
      id={rule.id}
      className={`flex items-center gap-4 px-5 py-3 scroll-mt-24 rounded-lg target:bg-brand-tint target:ring-1 target:ring-brand-line ${!rule.active ? "opacity-50" : ""}`}
    >
      {/* Priority dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[rule.priority]}`} />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">{rule.title}</p>
        <p className="text-xs text-ink-4 mt-0.5">
          {freqLabel(rule)} · {assigneeName}
          {rule.next_due && ` · Next: ${format(parseISO(rule.next_due), "MMM d")}`}
        </p>
      </div>

      {/* Active toggle — doubles as soft-archive (paused = archived) */}
      <button
        onClick={() =>
          startTransition(async () => { await toggleRecurringRule(rule.id, !rule.active); })
        }
        disabled={isPending}
        className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
          rule.active
            ? "bg-brand-tint text-brand hover:bg-brand-tint"
            : "bg-sunken text-ink-3 hover:bg-line"
        }`}
        title={rule.active ? "Pause this rule (no new tasks will be generated)" : "Resume this rule"}
      >
        {rule.active ? "Active" : "Paused"}
      </button>
    </div>
  );
}
