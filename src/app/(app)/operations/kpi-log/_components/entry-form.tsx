"use client";

import { useRef, useState, useTransition } from "react";
import { createEntry } from "@/lib/kpi-log/actions";
import { SECTION_FIELDS, type FieldDef } from "./fields";
import type { SectionId } from "@/lib/kpi-log/schemas";

const initial = { error: null, success: false };
const fieldClass = "field-input";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EntryForm({ section, canSubmit }: { section: SectionId; canSubmit: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fields = SECTION_FIELDS[section];

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await createEntry(initial, formData);
      if (result.success) {
        formRef.current?.reset();
        setOpen(false);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  };

  if (!canSubmit) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-white p-4 text-center text-sm text-ink-3">
        Read-only view — only office and admin can add entries.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary w-full sm:w-auto"
      >
        + New entry
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="rounded-xl border border-line bg-white p-5 space-y-3"
    >
      <input type="hidden" name="section_id" value={section} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Date</label>
          <input
            type="date"
            name="entry_date"
            defaultValue={todayISO()}
            required
            className={fieldClass}
          />
        </div>
        {fields.map((f) => (
          <FieldInput key={f.name} field={f} />
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Notes</label>
        <textarea name="notes" rows={2} className={`${fieldClass} resize-none`} placeholder="Optional" />
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add entry"}
        </button>
      </div>
    </form>
  );
}

function FieldInput({ field }: { field: FieldDef }) {
  const name = `p_${field.name}`;
  const common = {
    name,
    required: field.required,
    className: fieldClass,
    placeholder: field.placeholder,
  };
  return (
    <div>
      <label className="block text-xs font-medium text-ink-3 mb-1">
        {field.label}
        {field.required && <span className="text-danger"> *</span>}
      </label>
      {field.type === "text" && <input type="text" {...common} />}
      {field.type === "number" && <input type="number" step="0.1" min="0" {...common} />}
      {field.type === "yn" && (
        <select {...common} defaultValue="Y">
          <option value="Y">Yes</option>
          <option value="N">No</option>
        </select>
      )}
      {field.type === "passfail" && (
        <select {...common} defaultValue="pass">
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
        </select>
      )}
      {field.type === "textarea" && <textarea rows={2} {...common} className={`${fieldClass} resize-none`} />}
    </div>
  );
}
