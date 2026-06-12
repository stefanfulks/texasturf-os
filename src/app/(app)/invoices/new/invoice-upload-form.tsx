"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitInvoice, type SubmitInvoiceState } from "../actions";
import type { Vendor } from "@/lib/db-helpers.types";

const field = "w-full text-sm border border-line rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white";
const initial: SubmitInvoiceState = { error: null, invoiceId: null };

const VENDOR_TYPE_LABELS: Record<string, string> = {
  installer: "Installer", contractor_1099: "1099 Contractor",
  subcontractor: "Subcontractor", supplier: "Supplier", other: "Other",
};

type Props = {
  vendors: Vendor[];
};

export function InvoiceUploadForm({ vendors }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState(submitInvoice, initial);

  const [preview, setPreview]     = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl]   = useState<string | null>(null);
  const [uploadedType, setUploadedType] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploadError, setUploadError]   = useState<string | null>(null);

  useEffect(() => {
    if (state.invoiceId) {
      router.push(`/invoices/${state.invoiceId}`);
    }
  }, [state.invoiceId, router]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    setUploadError(null);

    // Preview for images
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }

    // Upload to Supabase Storage
    setUploading(true);
    const path = `invoices/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { data, error } = await supabase.storage
      .from("invoices")
      .upload(path, f, { cacheControl: "3600", upsert: false });

    if (error) {
      setUploadError(error.message);
      setUploading(false);
      return;
    }

    // Get signed URL (24h)
    const { data: signed } = await supabase.storage
      .from("invoices")
      .createSignedUrl(data.path, 60 * 60 * 24);

    setUploadedUrl(signed?.signedUrl ?? null);
    setUploadedType(f.type);
    setUploadedName(f.name);
    setUploading(false);
  }

  const isSubmitting = isPending || uploading;

  return (
    <form action={formAction} className="space-y-5">
      {/* Hidden file fields */}
      {uploadedUrl  && <input type="hidden" name="original_file_url"  value={uploadedUrl}  />}
      {uploadedType && <input type="hidden" name="original_file_type" value={uploadedType} />}
      {uploadedName && <input type="hidden" name="original_file_name" value={uploadedName} />}

      {/* File upload zone */}
      <div>
        <label className="block text-sm font-medium text-ink-2 mb-2">Invoice Image / PDF</label>
        <div
          onClick={() => fileRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
            uploadedUrl ? "border-brand/30 bg-brand-tint" : "border-line-strong bg-hover hover:border-line-strong hover:bg-sunken"
          }`}
        >
          {preview ? (
            // preview is a data: URL — unoptimized is required for next/image
            <Image
              src={preview}
              alt="Preview"
              width={800}
              height={600}
              unoptimized
              className="max-h-48 w-auto rounded-lg object-contain"
            />
          ) : uploadedUrl && !preview ? (
            <div className="flex flex-col items-center gap-2 text-brand">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-sm font-medium">{uploadedName}</span>
            </div>
          ) : (
            <>
              <svg className="w-10 h-10 text-ink-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <div className="text-center">
                <p className="text-sm font-medium text-ink-2">Tap to upload photo or PDF</p>
                <p className="text-xs text-ink-4 mt-0.5">or drag and drop · Max 20 MB</p>
              </div>
            </>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
              <div className="flex items-center gap-2 text-sm text-ink-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Uploading…
              </div>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploadError && <p className="text-xs text-danger mt-1">{uploadError}</p>}
        <p className="text-xs text-ink-4 mt-1">After upload, AI will extract invoice details automatically</p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-ink-2 mb-1.5">Invoice Name *</label>
        <input
          name="title"
          required
          placeholder="Hillcast Invoice 4/13–4/17"
          className={field}
        />
      </div>

      {/* Vendor */}
      <div>
        <label className="block text-sm font-medium text-ink-2 mb-1.5">Vendor / Contractor</label>
        <select name="vendor_id" defaultValue="" className={field}>
          <option value="">Select vendor…</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {VENDOR_TYPE_LABELS[v.type]}
            </option>
          ))}
        </select>
      </div>

      {/* Invoice number + Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">Invoice # <span className="text-ink-4 font-normal">(optional)</span></label>
          <input
            name="invoice_number"
            placeholder="INV-2024-001"
            className={field}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">Amount</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-4 text-sm">$</span>
            <input
              name="total_amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="8,580.00"
              className={`${field} pl-7`}
            />
          </div>
        </div>
      </div>

      {/* Service period */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">Service Period Start</label>
          <input type="date" name="service_period_start" className={field} />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">Service Period End</label>
          <input type="date" name="service_period_end" className={field} />
        </div>
      </div>

      {/* Job #(s) */}
      <div>
        <label className="block text-sm font-medium text-ink-2 mb-1.5">Job #(s) <span className="text-ink-4 font-normal">(optional)</span></label>
        <input name="job_name" placeholder="e.g. 4821, 4822" className={field} />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-ink-2 mb-1.5">Notes</label>
        <textarea name="notes" rows={3} placeholder="Any notes about this invoice…" className={`${field} resize-none`} />
      </div>

      {state.error && (
        <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-xl px-4 py-3">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 text-base font-semibold bg-ink text-white rounded-2xl hover:bg-ink disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? (uploading ? "Uploading file…" : "Submitting invoice…") : "Submit Invoice"}
      </button>
    </form>
  );
}
