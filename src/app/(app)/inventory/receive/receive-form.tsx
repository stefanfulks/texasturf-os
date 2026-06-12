"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";
import {
  receiveRoll,
  previewBulkPaste,
  submitBulkPaste,
  type ReceiveRollState,
  type BulkPreviewState,
  type BulkSubmitState,
} from "./actions";
import type { Vendor, InvProduct, InvLocation } from "@/lib/db-helpers.types";

const field =
  "w-full text-sm border border-line rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white";

type Props = {
  vendors: Pick<Vendor, "id" | "name">[];
  products: Pick<InvProduct, "id" | "name" | "sku" | "width_ft">[];
  locations: Pick<InvLocation, "id" | "name">[];
  defaultLocationId: string;
};

type RecentRoll = {
  id: string;
  tag: string | null;
  productName: string | null;
};

const initialReceive: ReceiveRollState = {
  error: null,
  rollId: null,
  rollTag: null,
  rollProductName: null,
};

const initialPreview: BulkPreviewState = {
  error: null,
  rows: [],
  rawCsv: "",
  hasErrors: false,
};

const initialSubmit: BulkSubmitState = {
  error: null,
  createdCount: 0,
  failedRows: [],
};

export function ReceiveForm({ vendors, products, locations, defaultLocationId }: Props) {
  const [mode, setMode] = useState<"quick" | "bulk">("quick");

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="inline-flex rounded-xl bg-sunken p-1">
        <button
          type="button"
          onClick={() => setMode("quick")}
          className={
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
            (mode === "quick" ? "bg-white text-ink shadow-sm" : "text-ink-2 hover:text-ink")
          }
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Quick Add
        </button>
        <button
          type="button"
          onClick={() => setMode("bulk")}
          className={
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
            (mode === "bulk" ? "bg-white text-ink shadow-sm" : "text-ink-2 hover:text-ink")
          }
        >
          <FileText className="w-4 h-4" aria-hidden="true" /> Bulk Paste
        </button>
      </div>

      {mode === "quick" ? (
        <QuickAddForm
          vendors={vendors}
          products={products}
          locations={locations}
          defaultLocationId={defaultLocationId}
        />
      ) : (
        <BulkPasteForm />
      )}
    </div>
  );
}

// ─── Quick Add ────────────────────────────────────────────────────────────────

function QuickAddForm({
  vendors,
  products,
  locations,
  defaultLocationId,
}: Pick<Props, "vendors" | "products" | "locations" | "defaultLocationId">) {
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const lengthRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState(receiveRoll, initialReceive);
  const [recent, setRecent] = useState<RecentRoll[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [originalLength, setOriginalLength] = useState<string>("");
  const lastHandledRoll = useRef<string | null>(null);

  // When product changes, prefill width from product if available
  useEffect(() => {
    const product = products.find((p) => p.id === productId);
    if (product?.width_ft && widthRef.current && !widthRef.current.value) {
      widthRef.current.value = String(product.width_ft);
    }
  }, [productId, products]);

  // On success: append to recent list, reset form, refocus first field
  useEffect(() => {
    if (state.rollId && state.rollId !== lastHandledRoll.current) {
      lastHandledRoll.current = state.rollId;
      setRecent((prev) =>
        [
          { id: state.rollId!, tag: state.rollTag, productName: state.rollProductName },
          ...prev,
        ].slice(0, 5),
      );
      formRef.current?.reset();
      setProductId("");
      setOriginalLength("");
      firstFieldRef.current?.focus();
    }
  }, [state]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <form
        ref={formRef}
        action={formAction}
        className="lg:col-span-2 rounded-2xl border border-line bg-white p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">Vendor</label>
          <select
            ref={firstFieldRef}
            name="vendor_id"
            defaultValue=""
            className={field}
          >
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">Product</label>
            <select
              name="product_id"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={field}
            >
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` · ${p.sku}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">
              Location <span className="text-ink-4 font-normal">(optional)</span>
            </label>
            <select name="location_id" defaultValue={defaultLocationId} className={field}>
              <option value="">Select location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">Width (ft)</label>
            <input
              ref={widthRef}
              type="number"
              step="0.01"
              min="0"
              name="width_ft"
              placeholder="e.g. 15"
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">
              Length (ft) <span className="text-danger">*</span>
            </label>
            <input
              ref={lengthRef}
              type="number"
              step="0.01"
              min="0"
              required
              name="original_length_ft"
              value={originalLength}
              onChange={(e) => setOriginalLength(e.target.value)}
              placeholder="e.g. 100"
              className={field}
            />
            <p className="text-xs text-ink-4 mt-1">Current length will auto-fill to this value.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">Dye Lot</label>
            <input name="dye_lot" placeholder="DL-2024-001" className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">Mfr Roll #</label>
            <input name="manufacturer_roll_number" placeholder="From mfr tag" className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">
              TT SKU Tag <span className="text-ink-4 font-normal">(auto)</span>
            </label>
            <input
              name="tt_sku_tag_number"
              placeholder="Auto-generate if blank"
              className={`${field} font-mono`}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">Notes</label>
          <textarea
            name="notes"
            rows={2}
            placeholder="Optional notes…"
            className={`${field} resize-none`}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="pending"
            value="on"
            className="h-4 w-4 rounded border-line-strong text-ink focus:ring-line-strong"
          />
          <span className="text-sm text-ink-2">
            Mark as <span className="font-medium">Planned</span> (needs review before available)
          </span>
        </label>

        {state.error && (
          <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-xl px-4 py-3">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 text-sm font-semibold bg-ink text-white rounded-xl hover:bg-ink disabled:opacity-50 transition-colors"
          >
            {isPending ? "Receiving…" : "Receive Roll"}
          </button>
          <button
            type="button"
            onClick={() => {
              formRef.current?.reset();
              setProductId("");
              setOriginalLength("");
              firstFieldRef.current?.focus();
            }}
            className="px-4 py-2.5 text-sm font-medium text-ink-2 hover:text-ink"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Just-received sidebar */}
      <div className="rounded-2xl border border-line bg-white p-5 h-fit">
        <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand" aria-hidden="true" />
          Just received
          <span className="text-xs font-normal text-ink-4">Last {recent.length || 5}</span>
        </h3>
        {recent.length === 0 ? (
          <p className="text-xs text-ink-4 py-4">
            Rolls you add in this session will appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li
                key={r.id}
                className="p-2.5 rounded-lg bg-brand-tint border border-brand/30"
              >
                <p className="font-mono text-sm font-semibold text-brand">
                  {r.tag ?? r.id.slice(0, 8)}
                </p>
                {r.productName && (
                  <p className="text-xs text-brand mt-0.5">{r.productName}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Bulk Paste ───────────────────────────────────────────────────────────────

function BulkPasteForm() {
  const [previewState, previewAction, isPreviewing] = useActionState(
    previewBulkPaste,
    initialPreview,
  );
  const [submitState, submitAction, isSubmitting] = useActionState(
    submitBulkPaste,
    initialSubmit,
  );
  const [csv, setCsv] = useState("");

  const lastSubmittedCount = submitState.createdCount;
  const showResult = submitState.createdCount > 0 || submitState.error;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Paste CSV</h3>
          <p className="text-xs text-ink-3 mt-1">
            Columns:{" "}
            <code className="font-mono text-ink-2">
              tt_sku,manufacturer_roll,product,width,length,dye_lot,location
            </code>
            . Headers optional. Leave a tt_sku blank to auto-generate.
          </p>
        </div>

        <form action={previewAction} className="space-y-3">
          <textarea
            name="csv"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={
              "tt_sku,manufacturer_roll,product,width,length,dye_lot,location\n,M-001,Mighty Grass 80oz,15,100,DL-A,Receiving\n,M-002,Mighty Grass 80oz,15,98,DL-A,Receiving"
            }
            className={`${field} font-mono text-xs resize-y`}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPreviewing}
              className="px-4 py-2 text-sm font-semibold bg-white border border-line-strong text-ink rounded-xl hover:bg-hover disabled:opacity-50"
            >
              {isPreviewing ? "Parsing…" : "Preview"}
            </button>
            {previewState.error && (
              <p className="text-sm text-danger">{previewState.error}</p>
            )}
          </div>
        </form>
      </div>

      {previewState.rows.length > 0 && (
        <div className="rounded-2xl border border-line bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">
              Preview ({previewState.rows.length} row{previewState.rows.length === 1 ? "" : "s"})
            </h3>
            {previewState.hasErrors ? (
              <span className="inline-flex items-center gap-1 text-xs text-danger">
                <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" /> Has errors
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-brand">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Ready to import
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-hover text-left text-ink-2">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">TT SKU</th>
                  <th className="px-3 py-2 font-medium">Mfr Roll</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">W × L</th>
                  <th className="px-3 py-2 font-medium">Dye Lot</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {previewState.rows.map((r, i) => (
                  <tr key={i} className={r.errors.length > 0 ? "bg-danger-tint" : ""}>
                    <td className="px-3 py-2 text-ink-3">{i + 1}</td>
                    <td className="px-3 py-2 font-mono">{r.tt_sku_tag_number || "auto"}</td>
                    <td className="px-3 py-2">{r.manufacturer_roll_number || "—"}</td>
                    <td className="px-3 py-2">
                      {r.product_name || r.product || "—"}
                      {r.product && !r.product_id && (
                        <span className="ml-1 text-danger">(not found)</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.width || "—"} × {r.length || "—"}
                    </td>
                    <td className="px-3 py-2">{r.dye_lot || "—"}</td>
                    <td className="px-3 py-2">
                      {r.location_name || r.location || "—"}
                      {r.location && !r.location_id && (
                        <span className="ml-1 text-danger">(not found)</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.errors.length > 0 ? (
                        <span className="text-danger">{r.errors.join("; ")}</span>
                      ) : (
                        <span className="text-brand">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={submitAction} className="border-t border-line px-5 py-3 flex items-center justify-between">
            <input type="hidden" name="csv" value={previewState.rawCsv} />
            <p className="text-xs text-ink-3">
              {previewState.hasErrors
                ? "Fix the unmatched products / locations or pre-create them, then re-preview."
                : `Will create ${previewState.rows.length} roll${previewState.rows.length === 1 ? "" : "s"} as Available.`}
            </p>
            <button
              type="submit"
              disabled={isSubmitting || previewState.hasErrors}
              className="px-4 py-2 text-sm font-semibold bg-ink text-white rounded-xl hover:bg-ink disabled:opacity-50"
            >
              {isSubmitting ? "Importing…" : "Confirm import"}
            </button>
          </form>
        </div>
      )}

      {showResult && (
        <div
          className={
            "rounded-xl border px-4 py-3 flex items-start gap-3 " +
            (submitState.error
              ? "border-danger/30 bg-danger-tint text-danger"
              : "border-brand/30 bg-brand-tint text-brand")
          }
        >
          {submitState.error ? (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div className="flex-1 text-sm">
            {lastSubmittedCount > 0 && (
              <p className="font-medium">
                Imported {lastSubmittedCount} roll{lastSubmittedCount === 1 ? "" : "s"}.
              </p>
            )}
            {submitState.error && <p className="mt-0.5">{submitState.error}</p>}
            {submitState.failedRows.length > 0 && (
              <p className="mt-0.5">
                Failed rows: {submitState.failedRows.join(", ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCsv("")}
            className="text-current opacity-60 hover:opacity-100"
            aria-label="Clear"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
