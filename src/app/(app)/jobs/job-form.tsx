"use client";

import { useActionState } from "react";
import { createJob, updateJob, type JobFormState } from "./actions";
import type { Project } from "@/lib/db-helpers.types";

const initial: JobFormState = { error: null, success: false };
const field =
  "field-input";
const textareaCls =
  "w-full text-base border border-line-strong rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink bg-white resize-none";

const JOB_TYPES = [
  ["customer_install",  "Customer Installation"],
  ["commercial_bid",    "Commercial Bid / RFQ"],
  ["sales_marketing",   "Sales / Marketing"],
  ["operations",        "Operations"],
  ["warehouse",         "Warehouse"],
  ["admin",             "Admin"],
  ["strategic",         "Strategic Initiative"],
  ["warranty",          "Warranty / Service"],
  ["technology",        "Technology / Systems"],
] as const;

const JOB_STATUSES = [
  ["intake",            "Intake"],
  ["planning",          "Planning"],
  ["waiting_customer",  "Waiting on Customer"],
  ["waiting_internal",  "Waiting on Internal Team"],
  ["scheduled",         "Scheduled"],
  ["in_progress",       "In Progress"],
  ["blocked",           "Blocked"],
  ["ready_for_review",  "Ready for Review"],
  ["complete",          "Complete"],
  ["on_hold",           "On Hold"],
  ["cancelled",         "Cancelled"],
] as const;

export function JobForm({ mode, job }: { mode: "create" | "edit"; job?: Project }) {
  const action = mode === "create" ? createJob : updateJob;
  const [state, formAction, isPending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-5">
      {mode === "edit" && job && <input type="hidden" name="id" value={job.id} />}

      <div>
        <label className="block text-xs font-semibold text-ink-2 mb-1.5">Job Name <span className="text-danger">*</span></label>
        <input name="name" defaultValue={job?.name ?? ""} required placeholder="Smith Residential Install" className={field} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Type <span className="text-danger">*</span></label>
          <select name="type" defaultValue={job?.type ?? "customer_install"} className={field}>
            {JOB_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Status</label>
          <select name="status" defaultValue={job?.status ?? "intake"} className={field}>
            {JOB_STATUSES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Priority</label>
          <select name="priority" defaultValue={job?.priority ?? "normal"} className={field}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Due Date</label>
          <input type="date" name="due_date" defaultValue={job?.due_date ?? ""} className={field} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Customer / Company</label>
          <input name="customer_name" defaultValue={job?.customer_name ?? ""} placeholder="Smith Family" className={field} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Target Install Date</label>
          <input type="date" name="target_install_date" defaultValue={job?.target_install_date ?? ""} className={field} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-2 mb-1.5">Address / Location</label>
        <input name="address" defaultValue={job?.address ?? ""} placeholder="123 Main St, Austin TX" className={field} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-2 mb-1.5">Description / Scope</label>
        <textarea name="description" defaultValue={job?.description ?? ""} rows={3} placeholder="Brief description of the job scope…" className={textareaCls} />
      </div>

      {/* Jobber link lives in a dedicated panel on the detail page — but this
          form needs to stay editable for both create and edit, so we keep
          the input here too. */}
      <div>
        <label className="block text-xs font-semibold text-ink-2 mb-1.5">Jobber URL <span className="font-normal text-ink-4">(optional)</span></label>
        <input
          name="jobber_url"
          type="url"
          defaultValue={job?.jobber_url ?? ""}
          placeholder="https://app.getjobber.com/work_orders/…"
          className={field}
        />
        <p className="mt-1 text-[11px] text-ink-3">Paste the deep link from Jobber so the crew can jump straight to the work order.</p>
      </div>

      {state.success && mode === "edit" && (
        <p className="text-sm text-brand bg-brand-tint border border-brand/30 rounded-xl px-3 py-2">Saved.</p>
      )}
      {state.error && (
        <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-xl px-3 py-2">{state.error}</p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn btn-primary h-11 px-5 disabled:opacity-50">
          {isPending ? (mode === "create" ? "Creating…" : "Saving…") : (mode === "create" ? "Create Job" : "Save Changes")}
        </button>
      </div>
    </form>
  );
}
