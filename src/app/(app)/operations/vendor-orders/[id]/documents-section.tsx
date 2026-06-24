"use client";

import { useActionState } from "react";
import { uploadDocuments, removeDocument, type FormState } from "../actions";
import type { PoDocument } from "@/lib/db-helpers.types";

const initial: FormState = { error: null, success: false };

const CATEGORY_LABELS: Record<string, string> = {
  quote: "Vendor Quote",
  po: "Purchase Order",
  invoice: "Invoice",
  shipping: "Shipping Doc",
  photo: "Photo",
  other: "Other",
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function RemoveDoc({ id, path }: { id: string; path: string }) {
  const [, formAction, isPending] = useActionState(removeDocument, initial);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="path" value={path} />
      <button type="submit" disabled={isPending} className="text-xs text-ink-4 hover:text-danger disabled:opacity-50">
        {isPending ? "…" : "Remove"}
      </button>
    </form>
  );
}

export function DocumentsSection({
  id, docs, urls, canEdit,
}: {
  id: string;
  docs: PoDocument[];
  urls: Record<string, string>;
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState(uploadDocuments, initial);

  return (
    <div className="space-y-4">
      {docs.length === 0 ? (
        <p className="text-sm text-ink-4">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {docs.map((d) => {
            const url = urls[d.path];
            return (
              <li key={d.path} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-ink hover:underline line-clamp-1">{d.name}</a>
                  ) : (
                    <span className="text-sm font-medium text-ink-2 line-clamp-1">{d.name}</span>
                  )}
                  <p className="text-[11px] text-ink-4">{CATEGORY_LABELS[d.category ?? "other"] ?? "Other"} · {fmtSize(d.size)}</p>
                </div>
                {canEdit && <RemoveDoc id={id} path={d.path} />}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-line p-3">
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="block text-[11px] font-medium text-ink-3 mb-1">Type</label>
            <select name="category" defaultValue="quote" className="field-input btn-sm h-8 py-0 w-auto text-sm">
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-[11px] font-medium text-ink-3 mb-1">File(s)</label>
            <input type="file" name="files" multiple className="block w-full text-xs text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-sunken file:px-3 file:py-1.5 file:text-xs file:font-medium" />
          </div>
          <button type="submit" disabled={isPending} className="btn btn-line btn-sm disabled:opacity-50">
            {isPending ? "Uploading…" : "Upload"}
          </button>
          {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
