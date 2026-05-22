"use client";

import { useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toggleRecurringRule, deleteRecurringRule } from "./actions";
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

      {/* Active toggle */}
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
      >
        {rule.active ? "Active" : "Paused"}
      </button>

      {/* Delete */}
      <button
        onClick={() => {
          if (confirm("Delete this recurring rule? Tasks already created are kept.")) {
            startTransition(async () => { await deleteRecurringRule(rule.id); });
          }
        }}
        disabled={isPending}
        className="text-zinc-300 hover:text-red-500 transition-colors"
        title="Delete rule"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 001-1h4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>
    </div>
  );
}
