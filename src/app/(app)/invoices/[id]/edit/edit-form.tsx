"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateInvoiceFields, type UpdateInvoiceFieldsState } from "../../actions";
import type { Invoice, Vendor, Project } from "@/lib/db-helpers.types";

const field = "field-input";
const label = "field-label";

const initial: UpdateInvoiceFieldsState = { error: null, success: false };

export function EditInvoiceForm({
  invoice,
  vendors,
  projects,
}: {
  invoice: Invoice;
  vendors:  Pick<Vendor,  "id" | "name" | "type">[];
  projects: Pick<Project, "id" | "name" | "status">[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateInvoiceFields, initial);

  function onDone(formData: FormData) {
    // Pre-process empty strings into null/empty for the server action's getStr helper
    return formAction(formData);
  }

  // Pre-fill helpers (server returns null for empty fields)
  const v = <T extends string | number | null | undefined>(x: T) => (x == null ? "" : String(x));

  return (
    <form action={onDone} className="space-y-6">
      <input type="hidden" name="invoice_id" value={invoice.id} />

      {/* Basic info */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Basics</h2>

        <div>
          <p className={label}>Title</p>
          <input name="title" defaultValue={v(invoice.title)} className={field} required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className={label}>Vendor</p>
            <select name="vendor_id" defaultValue={v(invoice.vendor_id)} className={field}>
              <option value="">— None —</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.type ? ` (${vendor.type})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <p className={label}>Project</p>
            <select name="project_id" defaultValue={v(invoice.project_id)} className={field}>
              <option value="">— None —</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className={label}>Customer Name</p>
            <input name="customer_name" defaultValue={v(invoice.customer_name)} className={field} />
          </div>
          <div>
            <p className={label}>Job Name</p>
            <input name="job_name" defaultValue={v(invoice.job_name)} className={field} />
          </div>
        </div>
      </div>

      {/* Invoice meta */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Invoice meta</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className={label}>Invoice #</p>
            <input name="invoice_number" defaultValue={v(invoice.invoice_number)} className={field} />
          </div>
          <div>
            <p className={label}>Invoice Date</p>
            <input name="invoice_date" type="date" defaultValue={v(invoice.invoice_date)} className={field} />
          </div>
          <div>
            <p className={label}>Service Start</p>
            <input name="service_period_start" type="date" defaultValue={v(invoice.service_period_start)} className={field} />
          </div>
          <div>
            <p className={label}>Service End</p>
            <input name="service_period_end" type="date" defaultValue={v(invoice.service_period_end)} className={field} />
          </div>
          <div>
            <p className={label}>Approval Deadline</p>
            <input name="approval_deadline" type="date" defaultValue={v(invoice.approval_deadline)} className={field} />
          </div>
        </div>
      </div>

      {/* Amounts */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Amounts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className={label}>Subtotal</p>
            <input name="subtotal" type="number" inputMode="decimal" step="0.01" defaultValue={v(invoice.subtotal)} className={field} />
          </div>
          <div>
            <p className={label}>Tax</p>
            <input name="tax" type="number" inputMode="decimal" step="0.01" defaultValue={v(invoice.tax)} className={field} />
          </div>
          <div>
            <p className={label}>Total</p>
            <input name="total_amount" type="number" inputMode="decimal" step="0.01" defaultValue={v(invoice.total_amount)} className={field} />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Notes</h2>
        <div>
          <p className={label}>Admin notes</p>
          <textarea name="admin_notes" rows={3} defaultValue={v(invoice.admin_notes)} className={field} />
        </div>
        <div>
          <p className={label}>Variance notes</p>
          <textarea name="variance_notes" rows={2} defaultValue={v(invoice.variance_notes)} className={field} />
        </div>
      </div>

      {/* Footer */}
      {state.error && (
        <p className="text-sm text-danger">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-brand">Saved.</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-strong disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/invoices/${invoice.id}`)}
          className="px-4 py-2 card text-sm font-semibold text-ink-2 hover:border-line-strong transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
