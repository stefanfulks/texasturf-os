"use client";

import { useActionState } from "react";
import { createProject, updateProject, type ProjectFormState } from "./actions";
import type { Project } from "@/lib/database.types";

const initial: ProjectFormState = { error: null, success: false };
const field = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";

const PROJECT_TYPES = [
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

const PROJECT_STATUSES = [
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

export function ProjectForm({ mode, project }: { mode: "create" | "edit"; project?: Project }) {
  const action = mode === "create" ? createProject : updateProject;
  const [state, formAction, isPending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-5">
      {mode === "edit" && project && <input type="hidden" name="id" value={project.id} />}

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Project Name *</label>
        <input name="name" defaultValue={project?.name ?? ""} required placeholder="Smith Residential Install" className={field} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Type *</label>
          <select name="type" defaultValue={project?.type ?? "customer_install"} className={field}>
            {PROJECT_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Status</label>
          <select name="status" defaultValue={project?.status ?? "intake"} className={field}>
            {PROJECT_STATUSES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Priority</label>
          <select name="priority" defaultValue={project?.priority ?? "normal"} className={field}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Due Date</label>
          <input type="date" name="due_date" defaultValue={project?.due_date ?? ""} className={field} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Customer / Company</label>
          <input name="customer_name" defaultValue={project?.customer_name ?? ""} placeholder="Smith Family" className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Target Install Date</label>
          <input type="date" name="target_install_date" defaultValue={project?.target_install_date ?? ""} className={field} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Address / Location</label>
        <input name="address" defaultValue={project?.address ?? ""} placeholder="123 Main St, Austin TX" className={field} />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Description / Scope</label>
        <textarea name="description" defaultValue={project?.description ?? ""} rows={3} placeholder="Brief description of the project scope…" className={`${field} resize-none`} />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Jobber URL</label>
        <input name="jobber_url" defaultValue={project?.jobber_url ?? ""} placeholder="https://app.getjobber.com/..." className={field} />
      </div>

      {state.success && mode === "edit" && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Saved.</p>
      )}
      {state.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50">
          {isPending ? (mode === "create" ? "Creating…" : "Saving…") : (mode === "create" ? "Create Project" : "Save Changes")}
        </button>
      </div>
    </form>
  );
}
