"use client";

import { useMemo, useState } from "react";
import { calculateQuote, type Job, type Edging, type Extra } from "@/lib/pricing/calculator";
import {
  DEFAULT_ENGINE_CONFIG,
  commissionFor,
  laborRateFor,
  wasteFor,
  type EngineConfig,
} from "@/lib/engine/config";
import { parseJobDescription } from "@/lib/pricing/parser";

// ─── Styling helpers ──────────────────────────────────────────────────────────

const field        = "field-input";
const fieldNarrow  = field + " py-1.5";
const labelCls     = "text-xs font-medium text-ink-3 mb-1 block";
const sectionTitle = "text-sm font-semibold text-ink mb-3";
const sectionBox   = "card p-5 space-y-3";

// ─── Default job ──────────────────────────────────────────────────────────────

function defaultJob(): Job {
  return {
    product:        "",
    installedSqft:  0,
    wastePct:       10,
    application:    "soil",
    tearoutTier:    "1",
    access:         "normal",
    infillProduct:  "Sand",
    edgings:        [],
    nailerLF:       0,
    nailerType:     "standard",
    glueMode:       "perimeter",
    glueLF:         0,
    seamTapeLF:     0,
    laborRate:      1.60,
    extras:         [],
    targetMargin:   50,
  };
}

// Both suggestions delegate to the engine — the single implementation shared
// with the pitch-deck adapters, so this calculator and the deck can never
// drift apart again (they used to: greens got 10% waste + $1.60 labor there).
function suggestLaborRate(
  job: Pick<Job, "application" | "installedSqft" | "product">,
  config: EngineConfig,
): number {
  return laborRateFor(
    { application: job.application, installedSqft: job.installedSqft ?? 0, product: job.product },
    config,
  );
}

function suggestWastePct(productName: string, config: EngineConfig): number {
  return wasteFor(productName, config);
}

// ─── The calculator ──────────────────────────────────────────────────────────

export function PricingCalculator({ config }: { config?: EngineConfig }) {
  // Engine config — DB-backed when the server page supplies it (admin-edited
  // product costs, labor rates, waste, commission tiers), code defaults
  // otherwise. Shadows the old static imports so every usage below reads config.
  const engine = config ?? DEFAULT_ENGINE_CONFIG;
  const {
    TURF_PRODUCTS,
    INFILL_PRODUCTS,
    EDGING_PRODUCTS,
    NAILER_BOARD,
    TEAROUT_TIERS,
    COMMISSION_TIERS,
    CALCULATION_CONSTANTS: C,
  } = engine.pricing;

  const [job, setJob] = useState<Job>(defaultJob);
  const [nlText, setNlText] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [laborTouched, setLaborTouched] = useState(false);

  // Effective labor rate is derived: auto-suggest unless the user has typed one in.
  const effectiveLabor = laborTouched ? job.laborRate : suggestLaborRate(job, engine);
  const effectiveJob   = useMemo<Job>(() => ({ ...job, laborRate: effectiveLabor }), [job, effectiveLabor]);

  const result = useMemo(() => calculateQuote(effectiveJob, engine.pricing), [effectiveJob, engine]);

  const productKeys = useMemo(() => Object.keys(TURF_PRODUCTS), [TURF_PRODUCTS]);
  const infillKeys  = useMemo(() => Object.keys(INFILL_PRODUCTS), [INFILL_PRODUCTS]);
  const edgingKeys  = useMemo(() => Object.keys(EDGING_PRODUCTS), [EDGING_PRODUCTS]);

  const turf = TURF_PRODUCTS[job.product];
  const isAGL          = turf?.infillType === "agl";
  const isPuttingGreen = turf?.category   === "putting_green";
  const isConcrete     = job.application  === "concrete";

  function setField<K extends keyof Job>(key: K, value: Job[K]) {
    setJob((j) => ({ ...j, [key]: value }));
  }

  function applyParsed() {
    const parsed = parseJobDescription(nlText);
    setJob((j) => {
      const next: Job = { ...j };
      if (parsed.installedSqft != null) next.installedSqft = parsed.installedSqft;
      if (parsed.product)               next.product       = parsed.product;
      if (parsed.tearoutTier)           next.tearoutTier   = parsed.tearoutTier;
      if (parsed.application)           next.application   = parsed.application;
      if (parsed.access)                next.access        = parsed.access;
      if (parsed.edgings)               next.edgings       = parsed.edgings;
      if (parsed.nailerLF != null)      next.nailerLF      = parsed.nailerLF;
      if (parsed.wastePct != null)      next.wastePct      = parsed.wastePct;
      if (parsed.targetMargin != null)  next.targetMargin  = parsed.targetMargin;
      // If product was set, update default waste too (unless parsed also set waste)
      if (parsed.product && parsed.wastePct == null) {
        next.wastePct = suggestWastePct(parsed.product, engine);
      }
      return next;
    });
  }

  function resetAll() {
    setJob(defaultJob());
    setNlText("");
    setLaborTouched(false);
  }

  function copyQuote() {
    const lines: string[] = [];
    lines.push(`TexasTurf quote — ${job.product || "no product"} · ${job.installedSqft} sqft`);
    if (result.price != null)        lines.push(`Price: $${money(result.price)}  (${job.targetMargin}% GM)`);
    if (result.pricePerSqft != null) lines.push(`Per sqft: $${result.pricePerSqft.toFixed(2)}`);
    if (result.cogs)                 lines.push(`COGS: $${money(result.cogs)}`);
    if (result.grossProfit != null)  lines.push(`Gross profit: $${money(result.grossProfit)}`);
    if (result.commission != null)   lines.push(`Commission: $${money(result.commission)} (${Math.round(result.commissionRate*100)}%)`);
    if (result.companyNet != null)   lines.push(`Company net: $${money(result.companyNet)}`);
    if (result.reviewFlags.length)   lines.push(`\nManager review required: ${result.reviewFlags.join("; ")}`);
    if (result.lines.length) {
      lines.push("\nCOGS breakdown:");
      for (const l of result.lines) lines.push(`  ${l.label}: $${money(l.cost)}`);
    }
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    });
  }

  // ─── Edging row helpers ─────────────────────────────────────────────────────

  function addEdging() {
    setField("edgings", [...job.edgings, { type: "Metal Edging Black", lf: 0 }]);
  }
  function updateEdging(i: number, patch: Partial<Edging>) {
    setField("edgings", job.edgings.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function removeEdging(i: number) {
    setField("edgings", job.edgings.filter((_, idx) => idx !== i));
  }

  // ─── Extra line item helpers ────────────────────────────────────────────────

  function addExtra() {
    setField("extras", [...job.extras, { description: "", cost: 0 }]);
  }
  function updateExtra(i: number, patch: Partial<Extra>) {
    setField("extras", job.extras.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function removeExtra(i: number) {
    setField("extras", job.extras.filter((_, idx) => idx !== i));
  }

  // ─── Display strings ────────────────────────────────────────────────────────

  const tierLabel =
    commissionFor(job.targetMargin, COMMISSION_TIERS).tier?.label ?? "Manager review";

  const tierColor =
    job.targetMargin < 40 ? "bg-danger-tint text-danger"     :
    job.targetMargin < 50 ? "bg-warn-tint text-warn" :
    job.targetMargin < 60 ? "bg-info-tint text-info"   :
                            "bg-brand-tint text-brand";

  const rawHint = turf
    ? `Raw cost $${turf.cost.toFixed(2)}/sqft · roll ${turf.rollSize}` +
      (turf.historicalRange ? ` · historical sale $${turf.historicalRange[0]}–$${turf.historicalRange[2]}/sqft` : "")
    : "";

  const laborSuggestion = suggestLaborRate(job, engine);
  const laborHint = laborTouched
    ? `Default for this config: $${laborSuggestion.toFixed(2)}/sqft`
    : `Auto-set to $${laborSuggestion.toFixed(2)}/sqft based on type — edit to override`;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
      {/* LEFT — form */}
      <div className="space-y-5 min-w-0">

        {/* Quick entry */}
        <div className={sectionBox}>
          <h2 className={sectionTitle}>Quick entry (optional)</h2>
          <textarea
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            rows={3}
            placeholder="Paste job notes — e.g. '1500 sqft Saratoga 40, tear out cat 5, 60 lf black metal edging, normal access, 15% waste'."
            className={field}
          />
          <button
            type="button"
            onClick={applyParsed}
            disabled={!nlText.trim()}
            className="px-3 py-1.5 rounded-lg border border-line-strong bg-white text-sm font-medium text-ink-2 hover:border-line-strong disabled:opacity-50 transition-colors"
          >
            ↓ Parse into form
          </button>
        </div>

        {/* Product & size */}
        <div className={sectionBox}>
          <h2 className={sectionTitle}>Product & size</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Turf product</label>
              <select
                value={job.product}
                onChange={(e) => {
                  const p = e.target.value;
                  setJob((j) => ({ ...j, product: p, wastePct: suggestWastePct(p, engine) }));
                }}
                className={field}
              >
                <option value="">— Pick a product —</option>
                {productKeys.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Installed sq ft</label>
              <input
                type="number" inputMode="decimal" min={0} step={1}
                value={job.installedSqft || ""}
                onChange={(e) => setField("installedSqft", Math.max(0, Number(e.target.value) || 0))}
                placeholder="1500"
                className={field}
              />
            </div>
            <div>
              <label className={labelCls}>Waste %</label>
              <select
                value={String(job.wastePct)}
                onChange={(e) => setField("wastePct", Number(e.target.value))}
                className={field}
              >
                <option value="10">10% standard</option>
                <option value="15">15% complex</option>
                <option value="20">20% putting green</option>
                <option value="0">0% (custom)</option>
              </select>
            </div>
          </div>
          {rawHint && <p className="text-xs text-ink-3">{rawHint}</p>}
        </div>

        {/* Application */}
        <div className={sectionBox}>
          <h2 className={sectionTitle}>Application</h2>
          <PillGroup
            value={job.application}
            onChange={(v) => setField("application", v as Job["application"])}
            options={[
              { value: "soil",     label: "On soil / organic base" },
              { value: "concrete", label: "On concrete" },
            ]}
          />
        </div>

        {/* Tear-out + Access */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className={sectionBox}>
            <h2 className={sectionTitle}>Tear-out difficulty</h2>
            <select
              value={job.tearoutTier}
              onChange={(e) => setField("tearoutTier", e.target.value)}
              className={field}
            >
              {Object.entries(TEAROUT_TIERS).map(([tier, t]) => (
                <option key={tier} value={tier}>
                  {tier} — {t.description}{t.rate === "review" ? " (manager review)" : t.rate > 0 ? ` ($${t.rate}/sqft)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className={sectionBox}>
            <h2 className={sectionTitle}>Access</h2>
            <PillGroup
              value={job.access}
              onChange={(v) => setField("access", v as Job["access"])}
              options={[
                { value: "normal",    label: "Normal" },
                { value: "difficult", label: "Difficult" },
              ]}
            />
            <p className="text-xs text-ink-3">
              Difficult = stairs, steep driveway, long carry, restricted gates. Routes to manager review.
            </p>
          </div>
        </div>

        {/* Infill (hidden for AGL) */}
        {!isAGL && !isPuttingGreen && (
          <div className={sectionBox}>
            <h2 className={sectionTitle}>Infill</h2>
            <select
              value={job.infillProduct}
              onChange={(e) => setField("infillProduct", e.target.value)}
              className={field}
            >
              {infillKeys.map((k) => (
                <option key={k} value={k}>
                  {INFILL_PRODUCTS[k].label} — ${INFILL_PRODUCTS[k].costPerLb.toFixed(2)}/lb
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-3">{C.INFILL_LBS_PER_SQFT} lbs per sq ft</p>
          </div>
        )}
        {isPuttingGreen && (
          <div className={sectionBox}>
            <h2 className={sectionTitle}>Infill</h2>
            <p className="text-xs text-ink-3">
              Putting greens always use Sand infill — included automatically.
            </p>
          </div>
        )}

        {/* Edging & nailer */}
        <div className={sectionBox}>
          <h2 className={sectionTitle}>Edging & nailer board</h2>
          {job.edgings.length === 0 && (
            <p className="text-xs text-ink-3">No edging runs added.</p>
          )}
          {job.edgings.map((e, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-2 items-end">
              <div>
                <label className={labelCls}>Type</label>
                <select
                  value={e.type}
                  onChange={(ev) => updateEdging(i, { type: ev.target.value })}
                  className={fieldNarrow}
                >
                  {edgingKeys.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>LF</label>
                <input
                  type="number" inputMode="decimal" min={0} step={1}
                  value={e.lf || ""}
                  onChange={(ev) => updateEdging(i, { lf: Math.max(0, Number(ev.target.value) || 0) })}
                  className={fieldNarrow}
                />
              </div>
              <button
                type="button"
                onClick={() => removeEdging(i)}
                aria-label={`Remove edging row ${i + 1}`}
                title="Remove this edging run"
                className="self-end h-8 w-8 rounded-md border border-line bg-white text-ink-3 hover:text-danger hover:border-danger/30 transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addEdging}
            className="px-3 py-1.5 rounded-lg border border-line-strong bg-white text-xs font-medium text-ink-2 hover:border-line-strong transition-colors"
          >
            + Add edging run
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-line">
            <div>
              <label className={labelCls}>Nailer board LF</label>
              <input
                type="number" inputMode="decimal" min={0} step={1}
                value={job.nailerLF || ""}
                onChange={(e) => setField("nailerLF", Math.max(0, Number(e.target.value) || 0))}
                className={field}
              />
            </div>
            <div>
              <label className={labelCls}>Nailer type</label>
              <select
                value={job.nailerType}
                onChange={(e) => setField("nailerType", e.target.value as Job["nailerType"])}
                className={field}
              >
                <option value="standard">Standard — ${NAILER_BOARD.standard.costPerLF}/LF</option>
                <option value="concrete_anchors">Anchored — ${NAILER_BOARD.concrete_anchors.costPerLF}/LF</option>
              </select>
            </div>
          </div>
        </div>

        {/* Concrete-specific */}
        {isConcrete && (
          <div className={sectionBox}>
            <h2 className={sectionTitle}>Concrete install specifics</h2>
            <PillGroup
              value={job.glueMode}
              onChange={(v) => setField("glueMode", v as Job["glueMode"])}
              options={[
                { value: "perimeter", label: "Perimeter + seams only" },
                { value: "full",      label: "Full glue-down" },
              ]}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {job.glueMode === "perimeter" && (
                <div>
                  <label className={labelCls}>Perimeter + seam LF (1 gal / 100 LF)</label>
                  <input
                    type="number" inputMode="decimal" min={0} step={1}
                    value={job.glueLF || ""}
                    onChange={(e) => setField("glueLF", Math.max(0, Number(e.target.value) || 0))}
                    className={field}
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>Seam tape LF (optional)</label>
                <input
                  type="number" inputMode="decimal" min={0} step={1}
                  value={job.seamTapeLF || ""}
                  onChange={(e) => setField("seamTapeLF", Math.max(0, Number(e.target.value) || 0))}
                  className={field}
                />
              </div>
            </div>
            {job.glueMode === "full" && (
              <p className="text-xs text-ink-3">
                Full glue-down uses 1 gallon per {C.GLUE_SQFT_PER_GAL} sqft — auto-calculated.
              </p>
            )}
          </div>
        )}

        {/* Sub labor */}
        <div className={sectionBox}>
          <h2 className={sectionTitle}>Sub labor rate</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>$/sq ft paid to installer</label>
              <input
                type="number" inputMode="decimal" step={0.05} min={0}
                value={effectiveLabor}
                onChange={(e) => { setField("laborRate", Number(e.target.value) || 0); setLaborTouched(true); }}
                className={field}
              />
            </div>
            <p className="text-xs text-ink-3 sm:self-end sm:pb-2">{laborHint}</p>
          </div>
        </div>

        {/* Extras */}
        <div className={sectionBox}>
          <h2 className={sectionTitle}>Other line items</h2>
          {job.extras.length === 0 && (
            <p className="text-xs text-ink-3">No extras added.</p>
          )}
          {job.extras.map((ex, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-2 items-end">
              <div>
                <label className={labelCls}>Description</label>
                <input
                  value={ex.description}
                  onChange={(e) => updateExtra(i, { description: e.target.value })}
                  placeholder="river rock, pavers, service call…"
                  className={fieldNarrow}
                />
              </div>
              <div>
                <label className={labelCls}>Cost</label>
                <input
                  type="number" inputMode="decimal" min={0} step={0.01}
                  value={ex.cost || ""}
                  onChange={(e) => updateExtra(i, { cost: Math.max(0, Number(e.target.value) || 0) })}
                  className={fieldNarrow}
                />
              </div>
              <button
                type="button"
                onClick={() => removeExtra(i)}
                aria-label={`Remove line item ${i + 1}`}
                title="Remove this line item"
                className="self-end h-8 w-8 rounded-md border border-line bg-white text-ink-3 hover:text-danger hover:border-danger/30 transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addExtra}
            className="px-3 py-1.5 rounded-lg border border-line-strong bg-white text-xs font-medium text-ink-2 hover:border-line-strong transition-colors"
          >
            + Add line
          </button>
        </div>

        {/* Margin slider */}
        <div className={sectionBox}>
          <h2 className={sectionTitle}>Target gross margin</h2>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={C.MARGIN_SLIDER_MIN}
              max={C.MARGIN_SLIDER_MAX}
              step={1}
              value={job.targetMargin}
              aria-label="Target gross margin percentage"
              aria-valuetext={`${job.targetMargin} percent — ${tierLabel}`}
              onChange={(e) => setField("targetMargin", Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-2xl font-bold tabular-nums w-14 text-right" aria-hidden="true">{job.targetMargin}%</span>
            <span className={`px-2 py-1 rounded-md text-xs font-semibold ${tierColor}`}>{tierLabel}</span>
          </div>
          {result.nextTier && (
            <p className="text-xs text-info bg-info-tint border border-info/30 rounded-lg px-3 py-2">
              Raise to <strong>{result.nextTier.marginTarget}%</strong> →
              price +${money(result.nextTier.priceDelta)},
              commission +${money(result.nextTier.commissionDelta)}
              ({Math.round(result.nextTier.newRate * 100)}% rate)
            </p>
          )}
          <p className="text-xs text-ink-3">
            40–49% → 4% of GP · 50–59% → 6% · 60%+ → 8% · under 40% → manager review
          </p>
        </div>
      </div>

      {/* RIGHT — sticky output */}
      <div className="lg:sticky lg:top-6 self-start">
        <div className="rounded-xl border border-ink bg-ink text-ink-4 p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-4">Quote price</p>
            <p className="text-4xl font-bold tabular-nums mt-1">
              {result.price != null ? `$${money(result.price)}` : "—"}
            </p>
            {result.pricePerSqft != null && (
              <p className="text-xs text-ink-4 mt-1">
                ${result.pricePerSqft.toFixed(2)}/sqft
                {turf?.historicalRange &&
                  ` · historical $${turf.historicalRange[0]}–$${turf.historicalRange[2]}/sqft`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Total COGS"  value={result.cogs        ? `$${money(result.cogs)}`                              : "—"} />
            <Metric label="Gross profit" value={result.grossProfit != null ? `$${money(result.grossProfit)}`              : "—"} />
            <Metric label={`Commission${result.commissionRate ? ` (${Math.round(result.commissionRate*100)}%)` : ""}`}
                                         value={result.commission   != null ? `$${money(result.commission)}`              : "—"} />
            <Metric label="Company net"  value={result.companyNet   != null ? `$${money(result.companyNet)}`              : "—"} />
          </div>

          {result.reviewFlags.length > 0 && (
            <div className="rounded-lg bg-danger/40 border border-danger/30 px-3 py-2 text-xs text-danger space-y-0.5">
              <p className="font-semibold text-danger">Manager review required</p>
              <ul className="list-disc list-inside">
                {result.reviewFlags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {result.lines.length > 0 && (
            <div className="border-t border-line-strong pt-3 space-y-1.5">
              <p className="text-xs uppercase tracking-wider text-ink-4">COGS breakdown</p>
              {result.lines.map((l, i) => (
                <div key={i} className="flex justify-between text-xs gap-3">
                  <span className="text-ink-4 truncate">{l.label}</span>
                  <span className="text-ink-4 tabular-nums">${money(l.cost)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-line-strong">
            <button
              type="button"
              onClick={copyQuote}
              disabled={result.price == null && result.cogs === 0}
              className="flex-1 px-3 py-2 rounded-lg bg-white text-ink text-sm font-semibold hover:bg-line disabled:opacity-50 transition-colors"
            >
              {copyState === "copied" ? "Copied ✓" : "Copy quote"}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="px-3 py-2 rounded-lg border border-line-strong bg-transparent text-ink-4 text-sm font-medium hover:bg-ink transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tiny presentational helpers ──────────────────────────────────────────────

function PillGroup({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-white p-0.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors " +
              (active ? "bg-brand text-white" : "text-ink-2 hover:text-ink")
            }
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-4">{label}</p>
      <p className="text-base font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
