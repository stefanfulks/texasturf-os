"use client";

import { useActionState, useEffect, useState } from "react";
import { createRecurringRule, type RuleFormState } from "./actions";
import type { Profile, Project, RecurrenceFreq } from "@/lib/db-helpers.types";

const initial: RuleFormState = { error: null, success: false };
const field = "w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREQ_LABELS: Record<RecurrenceFreq, string> = {
  daily:    "Daily",
  weekly:   "Weekly",
  biweekly: "Every 2 weeks",
  monthly:  "Monthly",
};

export function RecurringRuleForm({
  profiles,
  projects,
  currentUserId,
}: {
  profiles: Profile[];
  projects: Project[];
  currentUserId: string;
}) {
  const [state, formAction, isPending] = useActionState(createRecurringRule, initial);
  const [freq, setFreq] = useState<RecurrenceFreq>("weekly");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.success) setOpen(false);
  }, [state.success]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium bg-ink text-white rounded-lg hover:bg-ink"
      >
        + New rule
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">New Recurring Rule</h3>
        <button onClick={() => setOpen(false)} className="text-ink-4 hover:text-ink-2 text-sm">✕</button>
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Task Title *</label>
          <input name="title" required placeholder="Weekly truck inspection" className={field} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Frequency</label>
            <select
              name="freq"
              value={freq}
              onChange={(e) => setFreq(e.target.value as RecurrenceFreq)}
              className={field}
            >
              {(Object.entries(FREQ_LABELS) as [RecurrenceFreq, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {(freq === "weekly" || freq === "biweekly") && (
            <div>
              <label className="block text-xs font-medium text-ink-3 mb-1">Day of Week</label>
              <select name="day_of_week" defaultValue="1" className={field}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}

          {freq === "monthly" && (
            <div>
              <label className="block text-xs font-medium text-ink-3 mb-1">Day of Month</label>
              <select name="day_of_month" defaultValue="1" className={field}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Priority</label>
            <select name="priority" defaultValue="normal" className={field}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Lead days</label>
            <input type="number" name="lead_days" defaultValue={0} min={0} max={30} className={field} />
            <p className="text-[11px] text-ink-4 mt-1">Create task N days before due</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Assign to</label>
            <select name="assignee_id" defaultValue={currentUserId} className={field}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? p.email.split("@")[0]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Project (optional)</label>
            <select name="project_id" defaultValue="" className={field}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Description (optional)</label>
          <textarea name="description" rows={2} placeholder="What needs to be done each time…" className={`${field} resize-none`} />
        </div>

        {state.error && (
          <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">{state.error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-ink-2 hover:text-ink">Cancel</button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium bg-ink text-white rounded-lg hover:bg-ink disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Create Rule"}
          </button>
        </div>
      </form>
    </div>
  );
}
