"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Minus, Plus, Square, Circle, Triangle, Ruler, Box } from "lucide-react";
import {
  MATERIALS,
  CATEGORY_LABELS,
  MATERIAL_BY_KEY,
  type MaterialCategory,
} from "@/lib/materials/data";
import {
  calculateMaterial,
  type ShapeMode,
} from "@/lib/materials/calculator";

// All form inputs use text-base (16px) so iOS Safari doesn't auto-zoom on focus.
// All tap targets are h-11 (44px) or larger to match Apple HIG minimums.

type ShapeKind = ShapeMode["kind"];

const SHAPES: { kind: ShapeKind; label: string; Icon: typeof Square }[] = [
  { kind: "rectangle", label: "Rectangle", Icon: Square },
  { kind: "circle",    label: "Circle",    Icon: Circle },
  { kind: "triangle",  label: "Triangle",  Icon: Triangle },
  { kind: "area",      label: "Area",      Icon: Ruler },
  { kind: "volume",    label: "Volume",    Icon: Box },
];

const CATEGORY_EMOJI: Record<MaterialCategory, string> = {
  decorative_stone: "🪨",
  gravel_base: "🪜",
  sand: "🏖️",
  soil_fill: "🌱",
  organic_mulch: "🍂",
  compost_amendment: "♻️",
  boulders: "🗿",
};

const PRESETS: { label: string; emoji: string; materialKey: string; lengthFt: number; widthFt: number; depthIn: number }[] = [
  { label: "10×10 river rock bed",     emoji: "🪨", materialKey: "river_rock_1_3",     lengthFt: 10, widthFt: 10, depthIn: 3 },
  { label: "4×20 flower bed mulch",    emoji: "🌸", materialKey: "hardwood_mulch",     lengthFt: 20, widthFt: 4,  depthIn: 3 },
  { label: "10×12 DG patio",           emoji: "🛤️", materialKey: "decomposed_granite", lengthFt: 12, widthFt: 10, depthIn: 3 },
  { label: "8×8 pea gravel pad",       emoji: "🪙", materialKey: "pea_gravel",         lengthFt: 8,  widthFt: 8,  depthIn: 2 },
  { label: "Sod prep 500 ft²",         emoji: "🟩", materialKey: "sandy_loam",         lengthFt: 25, widthFt: 20, depthIn: 4 },
];

function groupMaterials() {
  const groups = new Map<MaterialCategory, typeof MATERIALS>();
  for (const m of MATERIALS) {
    if (!groups.has(m.category)) groups.set(m.category, []);
    groups.get(m.category)!.push(m);
  }
  return groups;
}

export function MaterialsCalculator() {
  const [materialKey, setMaterialKey] = useState<string>("river_rock_1_3");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [lengthFt, setLengthFt] = useState(20);
  const [widthFt, setWidthFt] = useState(10);
  const [diameterFt, setDiameterFt] = useState(12);
  const [baseFt, setBaseFt] = useState(15);
  const [heightFt, setHeightFt] = useState(10);
  const [areaSqft, setAreaSqft] = useState(200);
  const [cubicYards, setCubicYards] = useState(5);
  const [depthIn, setDepthIn] = useState(3);
  const [wastePct, setWastePct] = useState(10);
  const [copied, setCopied] = useState(false);

  const groups = useMemo(() => groupMaterials(), []);
  const material = MATERIAL_BY_KEY[materialKey];

  function pickMaterial(key: string) {
    setMaterialKey(key);
    const m = MATERIAL_BY_KEY[key];
    if (m) setDepthIn(m.defaultDepthIn);
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    pickMaterial(p.materialKey);
    setShapeKind("rectangle");
    setLengthFt(p.lengthFt);
    setWidthFt(p.widthFt);
    setDepthIn(p.depthIn);
  }

  const shape: ShapeMode = useMemo(() => {
    switch (shapeKind) {
      case "rectangle": return { kind: "rectangle", lengthFt, widthFt };
      case "circle":    return { kind: "circle", diameterFt };
      case "triangle":  return { kind: "triangle", baseFt, heightFt };
      case "area":      return { kind: "area", areaSqft };
      case "volume":    return { kind: "volume", cubicYards };
    }
  }, [shapeKind, lengthFt, widthFt, diameterFt, baseFt, heightFt, areaSqft, cubicYards]);

  const result = useMemo(
    () => calculateMaterial({ materialKey, shape, depthIn, wastePct }),
    [materialKey, shape, depthIn, wastePct],
  );

  async function copySummary() {
    const lines = [
      `Material: ${material?.name ?? materialKey}`,
      result.areaSqft != null
        ? `Area: ${fmt(result.areaSqft)} sq ft @ ${depthIn}" deep`
        : `Volume requested: ${cubicYards} cu yd`,
      `Order: ${result.orderCubicYards} cu yd  /  ${result.orderTons} tons  /  ${fmt(result.orderPounds)} lbs`,
      result.bales != null ? `Pine straw bales: ${result.bales}` : null,
      `Equivalent 2 cu ft bags: ${result.bagsTwoCuft}`,
      result.material && result.material.compactionFactor > 1
        ? `Includes ${Math.round((result.material.compactionFactor - 1) * 100)}% compaction allowance and ${wastePct}% waste.`
        : `Includes ${wastePct}% waste.`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard write can fail in non-HTTPS contexts.
    }
  }

  const showDepth = shapeKind !== "volume";
  const hasResult = result.orderCubicYards > 0;

  return (
    <div className="space-y-5 pb-32 lg:pb-6">
      {/* ─── Quick presets ─────────────────────────────────────────── */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2 px-1">
          Quick start
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap snap-x">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="shrink-0 snap-start flex items-center gap-2 rounded-full bg-white border border-line px-4 h-11 text-sm font-medium text-ink-2 hover:border-line-strong active:bg-hover"
            >
              <span className="text-base leading-none">{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        {/* ─── Inputs ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Material picker */}
          <Card>
            <CardHeader title="What are you laying?" hint="Tap to pick" />
            <div className="space-y-2">
              <select
                value={materialKey}
                onChange={(e) => pickMaterial(e.target.value)}
                className="w-full h-12 rounded-xl border border-line-strong bg-white px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-ink"
              >
                {Array.from(groups.entries()).map(([cat, items]) => (
                  <optgroup key={cat} label={`${CATEGORY_EMOJI[cat]}  ${CATEGORY_LABELS[cat]}`}>
                    {items.map((m) => (
                      <option key={m.key} value={m.key}>{m.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {material && (
                <div className="rounded-xl bg-hover border border-line p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{CATEGORY_EMOJI[material.category]}</span>
                    <p className="text-sm font-semibold text-ink">{material.name}</p>
                  </div>
                  {material.note && (
                    <p className="text-xs text-ink-2 leading-relaxed">{material.note}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Pill>{fmt(material.lbsPerYard)} lb/yd³</Pill>
                    {material.compactionFactor > 1 && (
                      <Pill tone="amber">compacts ~{Math.round((material.compactionFactor - 1) * 100)}%</Pill>
                    )}
                    <Pill tone="blue">sold by {material.soldBy}</Pill>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Shape picker */}
          <Card>
            <CardHeader title="What shape is the area?" />
            <div className="grid grid-cols-5 gap-1.5">
              {SHAPES.map(({ kind, label, Icon }) => {
                const active = shapeKind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setShapeKind(kind)}
                    className={
                      "flex flex-col items-center justify-center gap-1 h-16 rounded-xl border text-[11px] font-medium transition-colors " +
                      (active
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-white text-ink-2 active:bg-hover")
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 space-y-3">
              {shapeKind === "rectangle" && (
                <div className="grid grid-cols-2 gap-3">
                  <StepperField label="Length (ft)" value={lengthFt} onChange={setLengthFt} />
                  <StepperField label="Width (ft)" value={widthFt} onChange={setWidthFt} />
                </div>
              )}
              {shapeKind === "circle" && (
                <StepperField label="Diameter (ft)" value={diameterFt} onChange={setDiameterFt} />
              )}
              {shapeKind === "triangle" && (
                <div className="grid grid-cols-2 gap-3">
                  <StepperField label="Base (ft)" value={baseFt} onChange={setBaseFt} />
                  <StepperField label="Height (ft)" value={heightFt} onChange={setHeightFt} />
                </div>
              )}
              {shapeKind === "area" && (
                <StepperField label="Area (sq ft)" value={areaSqft} onChange={setAreaSqft} step={10} />
              )}
              {shapeKind === "volume" && (
                <StepperField label="Volume (cu yd)" value={cubicYards} onChange={setCubicYards} step={0.5} />
              )}
            </div>
          </Card>

          {/* Depth & waste */}
          {showDepth && (
            <Card>
              <CardHeader title="How deep & how much extra?" />
              <div className="grid grid-cols-2 gap-3">
                <StepperField
                  label="Depth (in)"
                  value={depthIn}
                  onChange={setDepthIn}
                  step={0.5}
                  hint={material ? `Typical ${material.depthRangeIn[0]}″–${material.depthRangeIn[1]}″` : undefined}
                />
                <StepperField
                  label="Waste %"
                  value={wastePct}
                  onChange={setWastePct}
                  step={5}
                  hint="10% covers trim & spillage."
                />
              </div>
            </Card>
          )}
        </div>

        {/* ─── Result (desktop) ───────────────────────────────────── */}
        <div className="hidden lg:block">
          <ResultCard
            result={result}
            material={material}
            wastePct={wastePct}
            depthIn={depthIn}
            copied={copied}
            onCopy={copySummary}
          />
        </div>
      </div>

      {/* ─── Sticky result (mobile only) ──────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <details className="group" open={hasResult}>
          <summary className="list-none cursor-pointer">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-ink-3">You&apos;ll need</p>
                <p className="text-base font-semibold text-ink tabular-nums truncate">
                  {result.orderTons} tons · {result.orderCubicYards} yd³
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); copySummary(); }}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-ink text-white text-xs font-semibold active:bg-ink"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </summary>
          <div className="px-4 pb-4 border-t border-line max-h-[60vh] overflow-y-auto">
            <ResultDetails result={result} material={material} wastePct={wastePct} depthIn={depthIn} compact />
          </div>
        </details>
      </div>
    </div>
  );
}

// ─── Result card ─────────────────────────────────────────────────────

function ResultCard({
  result, material, wastePct, depthIn, copied, onCopy,
}: {
  result: ReturnType<typeof calculateMaterial>;
  material: ReturnType<typeof calculateMaterial>["material"];
  wastePct: number;
  depthIn: number;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="lg:sticky lg:top-4 space-y-4">
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">You&apos;ll need to order</p>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-line bg-white text-xs font-semibold text-ink-2 hover:border-line-strong"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy summary"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <BigStat label="Tons" value={fmt(result.orderTons)} primary />
          <BigStat label="Cubic yards" value={fmt(result.orderCubicYards)} />
          <BigStat label="Pounds" value={fmt(result.orderPounds)} />
        </div>

        <div className="mt-4 pt-4 border-t border-line">
          <ResultDetails result={result} material={material} wastePct={wastePct} depthIn={depthIn} />
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="rounded-2xl border border-warn/30 bg-warn-tint p-4 text-sm text-warn space-y-1.5">
          {result.warnings.map((w, i) => <p key={i}>• {w}</p>)}
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-line bg-hover p-4 text-xs text-ink-3 leading-relaxed">
        <p className="font-medium text-ink-2 mb-1">How this is calculated</p>
        <p>
          Volume = area × depth. Loose order volume = finished × compaction × (1 + waste).
          Weight = loose volume × density. Wet material can run 10–20% heavier.
        </p>
      </div>
    </div>
  );
}

function ResultDetails({
  result, material, wastePct, depthIn, compact,
}: {
  result: ReturnType<typeof calculateMaterial>;
  material: ReturnType<typeof calculateMaterial>["material"];
  wastePct: number;
  depthIn: number;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {compact && (
        <div className="grid grid-cols-3 gap-2">
          <BigStat label="Tons" value={fmt(result.orderTons)} primary />
          <BigStat label="Cubic yards" value={fmt(result.orderCubicYards)} />
          <BigStat label="Pounds" value={fmt(result.orderPounds)} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {result.areaSqft != null && (
          <Stat label="Area" value={`${fmt(result.areaSqft)} sq ft`} />
        )}
        <Stat label="Finished volume" value={`${result.finishedCubicYards} yd³`} />
        <Stat label="Depth" value={`${depthIn}″`} />
        <Stat label="2 cu ft bags" value={`~${fmt(result.bagsTwoCuft)}`} hint="If buying retail." />
        {result.bales != null && (
          <Stat label="Pine straw bales" value={fmt(result.bales)} />
        )}
      </div>
      <p className="text-[11px] text-ink-3">
        {material && material.compactionFactor > 1
          ? `Includes ${Math.round((material.compactionFactor - 1) * 100)}% compaction + ${wastePct}% waste.`
          : `Includes ${wastePct}% waste.`}
      </p>
      {compact && result.warnings.length > 0 && (
        <div className="rounded-xl border border-warn/30 bg-warn-tint p-3 text-xs text-warn space-y-1">
          {result.warnings.map((w, i) => <p key={i}>• {w}</p>)}
        </div>
      )}
    </div>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 sm:p-5 space-y-3">
      {children}
    </section>
  );
}

function CardHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-end justify-between gap-2">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {hint && <span className="text-[11px] text-ink-4">{hint}</span>}
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blue" | "amber" }) {
  const map = {
    neutral: "bg-white text-ink-2 border-line",
    blue: "bg-info-tint text-info border-info/30",
    amber: "bg-warn-tint text-warn border-warn/30",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

function StepperField({
  label, value, onChange, step = 1, hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  hint?: string;
}) {
  const dec = () => onChange(Math.max(0, round(value - step)));
  const inc = () => onChange(round(value + step));
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-2 mb-1.5 block">{label}</span>
      <div className="flex items-stretch rounded-xl border border-line-strong bg-white overflow-hidden focus-within:ring-2 focus-within:ring-ink focus-within:border-ink">
        <button
          type="button"
          onClick={dec}
          aria-label={`Decrease ${label}`}
          className="w-11 h-12 flex items-center justify-center text-ink-3 hover:text-ink active:bg-sunken"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 h-12 px-1 text-center text-base font-semibold tabular-nums text-ink bg-white focus:outline-none"
        />
        <button
          type="button"
          onClick={inc}
          aria-label={`Increase ${label}`}
          className="w-11 h-12 flex items-center justify-center text-ink-3 hover:text-ink active:bg-sunken"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {hint && <span className="block text-[11px] text-ink-4 mt-1.5">{hint}</span>}
    </label>
  );
}

function BigStat({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className={
      "rounded-xl border p-3 " +
      (primary ? "border-ink bg-ink text-white" : "border-line bg-hover text-ink")
    }>
      <p className={"text-[10px] uppercase tracking-wider " + (primary ? "text-ink-4" : "text-ink-3")}>
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums leading-tight mt-0.5">{value}</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-3">{label}</p>
      <p className="text-sm font-semibold text-ink tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-ink-4">{hint}</p>}
    </div>
  );
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
