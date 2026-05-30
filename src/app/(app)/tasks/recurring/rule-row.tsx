"use client";

import { useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toggleRecurringRule } from "./actions";
import type { RecurringRule, RecurrenceFreq } from "@/lib/database.types";

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
  low:    "bg-zinc-300",
  normal: "bg-blue-400",
  high:   "bg-amber-400",
  urgent: "bg-red-500",
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
    <div className={`flex items-center gap-4 px-5 py-3 ${!rule.active ? "opacity-50" : ""}`}>
      {/* Priority dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[rule.priority]}`} />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900">{rule.title}</p>
        <p className="text-xs text-zinc-400 mt-0.5">
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
            ? "bg-green-100 text-green-700 hover:bg-green-200"
            : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
        }`}
        title={rule.active ? "Pause this rule (no new tasks will be generated)" : "Resume this rule"}
      >
        {rule.active ? "Active" : "Paused"}
      </button>
    </div>
  );
}
