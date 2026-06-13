"use client";

import { useActionState } from "react";
import { createJob, updateJob, type JobFormState } from "./actions";
import { JOB_STATUS_OPTIONS } from "@/components/inventory/job-status-badge";
import type { InvJob } from "@/lib/db-helpers.types";

const initial: JobFormState = { error: null, success: false };
const field =
  "field-input";

export function JobForm({ mode, job }: { mode: "create" | "edit"; job?: InvJob }) {
  const action = mode === "create" ? createJob : updateJob;
  const [state, formAction, isPending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-4">
      {mode === "edit" && job && <input type="hidden" name="id" value={job.id} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Job Number</label>
          <input
            name="job_number"
            defaultValue={job?.job_number ?? ""}
            placeholder="J-1042"
            className={field}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Status</label>
          <select name="status" defaultValue={job?.status ?? "planning"} className={field}>
            {JOB_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Job Name <span className="text-danger">*</span></label>
        <input
          name="job_name"
          required
          defaultValue={job?.job_name ?? ""}
          placeholder="Smith Residence — Backyard"
          className={field}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Site Address</label>
        <input
          name="site_address"
          defaultValue={job?.site_address ?? ""}
          placeholder="1234 Main St, Austin, TX"
          className={field}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Scheduled Date</label>
        <input
          type="date"
          name="scheduled_date"
          defaultValue={job?.scheduled_date ?? ""}
          className={field}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Notes</label>
        <textarea
          name="notes"
          defaultValue={job?.notes ?? ""}
          rows={3}
          className={`${field} resize-none`}
        />
      </div>

      {state.error && (
        <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state.success && mode === "edit" && (
        <p className="text-sm text-brand bg-brand-tint border border-brand/30 rounded-lg px-3 py-2">
          Saved.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary disabled:opacity-50"
        >
          {isPending
            ? (mode === "create" ? "Creating…" : "Saving…")
            : (mode === "create" ? "Create Job" : "Save Changes")}
        </button>
      </div>
    </form>
  );
}
