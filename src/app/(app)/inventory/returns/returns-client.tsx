"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  PackagePlus,
} from "lucide-react";
import { RollStatusBadge } from "@/components/inventory/roll-status-badge";
import {
  processReturns,
  processUnmarkedReturn,
  type ProcessReturnsState,
  type UnmarkedReturnState,
} from "./actions";
import type { InvJob, InvRoll, InvProduct } from "@/lib/database.types";

const field =
  "w-full text-sm border border-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";

type JobLite = Pick<InvJob, "id" | "job_number" | "job_name" | "status">;
type RollLite = Pick<
  InvRoll,
  | "id"
  | "tt_sku_tag_number"
  | "product_name"
  | "current_length_ft"
  | "width_ft"
  | "dye_lot"
  | "status"
>;
type ProductLite = Pick<InvProduct, "id" | "name" | "sku" | "width_ft">;

type Props = {
  jobs: JobLite[];
  products: ProductLite[];
  selectedJob: JobLite | null;
  jobRolls: RollLite[];
};

const initialUnmarked: UnmarkedReturnState = {
  error: null,
  rollId: null,
  matched: null,
};

function fmtLen(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " ft";
}

export function ReturnsClient({ jobs, products, selectedJob, jobRolls }: Props) {
  const [mode, setMode] = useState<"job" | "unmarked">(
    selectedJob ? "job" : "job",
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => setMode("job")}
          className={
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
            (mode === "job" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900")
          }
        >
          <Briefcase className="w-4 h-4" aria-hidden="true" /> Return from Job
        </button>
        <button
          type="button"
          onClick={() => setMode("unmarked")}
          className={
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
            (mode === "unmarked" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900")
          }
        >
          <PackagePlus className="w-4 h-4" aria-hidden="true" /> Unmarked Return
        </button>
      </div>

      {mode === "job" ? (
        <ReturnFromJob jobs={jobs} selectedJob={selectedJob} jobRolls={jobRolls} />
      ) : (
        <UnmarkedReturnForm products={products} />
      )}
    </div>
  );
}

// ─── Return from Job ──────────────────────────────────────────────────────────

type RollFormState = {
  selected: boolean;
  returnedLength: string;
  notes: string;
};

function ReturnFromJob({
  jobs,
  selectedJob,
  jobRolls,
}: {
  jobs: JobLite[];
  selectedJob: JobLite | null;
  jobRolls: RollLite[];
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [rollState, setRollState] = useState<Record<string, RollFormState>>({});
  const [isPending, startTransition] = useTransition();
  const [submitState, setSubmitState] = useState<ProcessReturnsState | null>(null);

  // Reset roll form state when the underlying job's roll set changes.
  useEffect(() => {
    setRollState({});
    setSubmitState(null);
  }, [selectedJob?.id]);

  const filteredRolls = jobRolls.filter((r) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (r.tt_sku_tag_number ?? "").toLowerCase().includes(q) ||
      (r.product_name ?? "").toLowerCase().includes(q) ||
      (r.dye_lot ?? "").toLowerCase().includes(q)
    );
  });

  const updateRoll = (id: string, patch: Partial<RollFormState>) => {
    setRollState((prev) => ({
      ...prev,
      [id]: {
        selected: prev[id]?.selected ?? false,
        returnedLength: prev[id]?.returnedLength ?? "",
        notes: prev[id]?.notes ?? "",
        ...patch,
      },
    }));
  };

  const toggleRoll = (roll: RollLite) => {
    const current = rollState[roll.id];
    const isNowSelected = !current?.selected;
    updateRoll(roll.id, {
      selected: isNowSelected,
      returnedLength:
        isNowSelected && !current?.returnedLength
          ? String(roll.current_length_ft ?? 0)
          : current?.returnedLength ?? "",
    });
  };

  const selectedRolls = jobRolls.filter((r) => rollState[r.id]?.selected);

  const handleSubmit = () => {
    setSubmitState(null);
    if (!selectedJob) return;
    if (selectedRolls.length === 0) {
      setSubmitState({ error: "Pick at least one roll to return.", processedCount: 0 });
      return;
    }

    const payload = selectedRolls.map((r) => {
      const f = rollState[r.id];
      return {
        roll_id:         r.id,
        returned_length: parseFloat(f?.returnedLength || "0") || 0,
        notes:           f?.notes?.trim() || undefined,
      };
    });

    startTransition(async () => {
      const fd = new FormData();
      fd.append("job_id", selectedJob.id);
      fd.append("rolls", JSON.stringify(payload));
      const result = await processReturns(fd);
      setSubmitState(result);
      if (!result.error) {
        setRollState({});
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Job</label>
          <select
            className={field}
            value={selectedJob?.id ?? ""}
            onChange={(e) => {
              const next = e.target.value;
              router.push(next ? `/inventory/returns?job=${next}` : "/inventory/returns");
            }}
          >
            <option value="">Select a job…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.job_number ? `${j.job_number} — ` : ""}
                {j.job_name}
                {j.status ? ` (${j.status.replace(/_/g, " ")})` : ""}
              </option>
            ))}
          </select>
          {jobs.length === 0 && (
            <p className="text-xs text-zinc-400 mt-1">
              No active jobs with dispatched rolls.
            </p>
          )}
        </div>
      </div>

      {selectedJob && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Allocated rolls ({jobRolls.length})
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Tick which came back. Enter the returned length (≤ current length). Zero means
                fully consumed on site.
              </p>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by tag, product, dye lot…"
              className="w-64 text-sm border border-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          {jobRolls.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              No rolls are currently allocated to this job.
            </div>
          ) : filteredRolls.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              No rolls match your filter.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {filteredRolls.map((roll) => {
                const f = rollState[roll.id];
                const selected = !!f?.selected;
                return (
                  <li key={roll.id} className={selected ? "bg-emerald-50/40" : ""}>
                    <label className="flex items-start gap-3 px-5 py-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleRoll(roll)}
                        className="mt-1 h-4 w-4 rounded border-zinc-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-zinc-800">
                            {roll.tt_sku_tag_number ?? roll.id.slice(0, 8)}
                          </span>
                          <RollStatusBadge status={roll.status} />
                          <span className="text-sm text-zinc-500">
                            {roll.product_name ?? "—"} ·{" "}
                            {fmtLen(roll.width_ft)} × {fmtLen(roll.current_length_ft)}
                            {roll.dye_lot ? ` · Dye lot ${roll.dye_lot}` : ""}
                          </span>
                        </div>

                        {selected && (
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">
                                Returned length (ft)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                max={roll.current_length_ft ?? undefined}
                                value={f?.returnedLength ?? ""}
                                onChange={(e) =>
                                  updateRoll(roll.id, { returnedLength: e.target.value })
                                }
                                onClick={(e) => e.stopPropagation()}
                                className={field}
                              />
                              <p className="text-xs text-zinc-400 mt-1">
                                0 = fully consumed. Max {fmtLen(roll.current_length_ft)}.
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">
                                Notes
                              </label>
                              <input
                                type="text"
                                value={f?.notes ?? ""}
                                onChange={(e) => updateRoll(roll.id, { notes: e.target.value })}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Optional"
                                className={field}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {jobRolls.length > 0 && (
            <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">
                {selectedRolls.length} selected
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || selectedRolls.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                {isPending ? "Processing…" : "Process returns"}
              </button>
            </div>
          )}
        </div>
      )}

      {submitState && (
        <div
          className={
            "rounded-xl border px-4 py-3 flex items-start gap-3 " +
            (submitState.error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800")
          }
        >
          {submitState.error ? (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div className="flex-1 text-sm">
            {submitState.error ? (
              <p>{submitState.error}</p>
            ) : (
              <p className="font-medium">
                Processed {submitState.processedCount} roll
                {submitState.processedCount === 1 ? "" : "s"}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Unmarked Return ──────────────────────────────────────────────────────────

function UnmarkedReturnForm({ products }: { products: ProductLite[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const tagRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState(processUnmarkedReturn, initialUnmarked);
  const [productId, setProductId] = useState("");
  const widthRef = useRef<HTMLInputElement>(null);
  const lastHandled = useRef<string | null>(null);

  // Prefill width from product
  useEffect(() => {
    const product = products.find((p) => p.id === productId);
    if (product?.width_ft && widthRef.current && !widthRef.current.value) {
      widthRef.current.value = String(product.width_ft);
    }
  }, [productId, products]);

  // Reset form on success
  useEffect(() => {
    if (state.rollId && state.rollId !== lastHandled.current) {
      lastHandled.current = state.rollId;
      formRef.current?.reset();
      setProductId("");
      tagRef.current?.focus();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4 max-w-3xl"
    >
      <div>
        <h3 className="text-base font-semibold text-zinc-900">Unmarked Return</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Receive a roll back when the job source is unknown. If the TT SKU tag matches an
          existing roll, that roll is updated; otherwise a new record is created.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            TT SKU Tag <span className="text-red-500">*</span>
          </label>
          <input
            ref={tagRef}
            name="tt_sku_tag_number"
            required
            placeholder="Scan or enter the tag"
            className={`${field} font-mono`}
          />
          <p className="text-xs text-zinc-400 mt-1">
            Will match an existing roll if the tag is found.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Returned length (ft) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            name="returned_length"
            placeholder="e.g. 42"
            className={field}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Product <span className="text-zinc-400 font-normal">(if new)</span>
          </label>
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
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Width (ft) <span className="text-zinc-400 font-normal">(if new)</span>
          </label>
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
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Dye lot <span className="text-zinc-400 font-normal">(if known)</span>
          </label>
          <input name="dye_lot" placeholder="DL-2024-001" className={field} />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Condition <span className="text-red-500">*</span>
          </label>
          <select name="condition" defaultValue="good" required className={field}>
            <option value="good">Good — restocking candidate</option>
            <option value="damaged">Damaged — write off</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Notes</label>
        <textarea
          name="notes"
          rows={2}
          placeholder="Where it was found, suspected job, etc."
          className={`${field} resize-none`}
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {state.error}
        </p>
      )}

      {state.matched && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3 text-sm text-green-800">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            {state.matched === "updated"
              ? "Matched the existing roll and updated it to Returned."
              : "No existing tag found — created a new Returned roll."}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 text-sm font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Log unmarked return"}
        </button>
        <button
          type="button"
          onClick={() => {
            formRef.current?.reset();
            setProductId("");
            tagRef.current?.focus();
          }}
          className="px-4 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
