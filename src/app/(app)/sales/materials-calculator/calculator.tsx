"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
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

const field =
  "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";
const labelCls = "text-xs font-medium text-zinc-500 mb-1 block";
const sectionTitle = "text-sm font-semibold text-zinc-900 mb-3";
const sectionBox = "rounded-xl border border-zinc-200 bg-white p-5 space-y-3";

type ShapeKind = ShapeMode["kind"];

const SHAPE_LABELS: Record<ShapeKind, string> = {
  rectangle: "Rectangle",
  circle: "Circle",
  triangle: "Triangle",
  area: "I know the area (sq ft)",
  volume: "I know the volume (cu yd)",
};

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

  // When the user picks a new material, snap the depth to that material's
  // default unless they've manually overridden — keep it simple: always snap.
  function pickMaterial(key: string) {
    setMaterialKey(key);
    const m = MATERIAL_BY_KEY[key];
    if (m) setDepthIn(m.defaultDepthIn);
  }

  const shape: ShapeMode = useMemo(() => {
    switch (shapeKind) {
      case "rectangle":
        return { kind: "rectangle", lengthFt, widthFt };
      case "circle":
        return { kind: "circle", diameterFt };
      case "triangle":
        return { kind: "triangle", baseFt, heightFt };
      case "area":
        return { kind: "area", areaSqft };
      case "volume":
        return { kind: "volume", cubicYards };
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
      // clipboard write can fail in non-HTTPS contexts — fall back to no-op.
    }
  }

  const showDepth = shapeKind !== "volume";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* ─── Inputs ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className={sectionBox}>
          <h2 className={sectionTitle}>Material</h2>
          <select
            value={materialKey}
            onChange={(e) => pickMaterial(e.target.value)}
            className={field}
          >
            {Array.from(groups.entries()).map(([cat, items]) => (
              <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                {items.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {material?.note && (
            <p className="text-xs text-zinc-500 leading-snug">{material.note}</p>
          )}
          <p className="text-[11px] text-zinc-400">
            Density: {fmt(material?.lbsPerYard ?? 0)} lb/yd³
            {material && material.compactionFactor > 1 && (
              <> · compacts ~{Math.round((material.compactionFactor - 1) * 100)}%</>
            )}
            {material && <> · sold by {material.soldBy}</>}
          </p>
        </div>

        <div className={sectionBox}>
          <h2 className={sectionTitle}>Area shape</h2>
          <select
            value={shapeKind}
            onChange={(e) => setShapeKind(e.target.value as ShapeKind)}
            className={field}
          >
            {(Object.keys(SHAPE_LABELS) as ShapeKind[]).map((k) => (
              <option key={k} value={k}>{SHAPE_LABELS[k]}</option>
            ))}
          </select>

          {shapeKind === "rectangle" && (
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Length (ft)" value={lengthFt} onChange={setLengthFt} />
              <NumberField label="Width (ft)" value={widthFt} onChange={setWidthFt} />
            </div>
          )}
          {shapeKind === "circle" && (
            <NumberField label="Diameter (ft)" value={diameterFt} onChange={setDiameterFt} />
          )}
          {shapeKind === "triangle" && (
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Base (ft)" value={baseFt} onChange={setBaseFt} />
              <NumberField label="Height (ft)" value={heightFt} onChange={setHeightFt} />
            </div>
          )}
          {shapeKind === "area" && (
            <NumberField label="Area (sq ft)" value={areaSqft} onChange={setAreaSqft} />
          )}
          {shapeKind === "volume" && (
            <NumberField label="Volume (cu yd)" value={cubicYards} onChange={setCubicYards} step={0.25} />
          )}
        </div>

        {showDepth && (
          <div className={sectionBox}>
            <h2 className={sectionTitle}>Depth & waste</h2>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label={`Depth (in)`}
                value={depthIn}
                onChange={setDepthIn}
                step={0.5}
                hint={
                  material
                    ? `Typical ${material.depthRangeIn[0]}″–${material.depthRangeIn[1]}″`
                    : undefined
                }
              />
              <NumberField
                label="Waste %"
                value={wastePct}
                onChange={setWastePct}
                step={1}
                hint="10% is a safe default for trim/spillage."
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── Results ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className={sectionBox}>
          <div className="flex items-center justify-between">
            <h2 className={sectionTitle + " mb-0"}>Order quantity</h2>
            <button
              type="button"
              onClick={copySummary}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-400"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy summary"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <BigStat label="Cubic yards" value={fmt(result.orderCubicYards)} />
            <BigStat label="Tons" value={fmt(result.orderTons)} />
            <BigStat label="Pounds" value={fmt(result.orderPounds)} />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {result.areaSqft != null && (
              <Stat label="Area" value={`${fmt(result.areaSqft)} sq ft`} />
            )}
            <Stat label="Finished volume" value={`${result.finishedCubicYards} yd³`} />
            <Stat
              label="2 cu ft bags"
              value={`~${fmt(result.bagsTwoCuft)}`}
              hint="Home-store bag count if buying retail."
            />
            {result.bales != null && (
              <Stat label="Pine straw bales" value={fmt(result.bales)} />
            )}
          </div>
        </div>

        {result.warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-1.5">
            {result.warnings.map((w, i) => (
              <p key={i}>• {w}</p>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500 leading-relaxed">
          <p className="font-medium text-zinc-700 mb-1">How this is calculated</p>
          <p>
            Volume = area × depth, then loose order volume = finished volume ×
            compaction × (1 + waste). Weight = loose volume × density. Densities
            and compaction factors are loose-bulk values typical for Texas
            landscape supply yards; wet material can weigh 10–20% more.
          </p>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        min={0}
        step={step ?? 1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={field}
      />
      {hint && <span className="block text-[11px] text-zinc-400 mt-1">{hint}</span>}
    </label>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-xl font-semibold text-zinc-900 tabular-nums">{value}</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-sm font-medium text-zinc-900 tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-zinc-400">{hint}</p>}
    </div>
  );
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
