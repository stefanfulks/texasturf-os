import { MATERIAL_BY_KEY, PINE_STRAW_SQFT_PER_BALE, type Material } from "./data";

export type ShapeMode =
  | { kind: "rectangle"; lengthFt: number; widthFt: number }
  | { kind: "circle"; diameterFt: number }
  | { kind: "triangle"; baseFt: number; heightFt: number }
  | { kind: "area"; areaSqft: number }
  | { kind: "volume"; cubicYards: number };

export type CalcInput = {
  materialKey: string;
  shape: ShapeMode;
  /** Inches. Ignored when shape is "volume". */
  depthIn: number;
  /** Extra fudge factor on top of compaction (waste, edge spillage). 0–1. */
  wastePct: number;
};

export type CalcResult = {
  material: Material | null;
  areaSqft: number | null;
  finishedCubicYards: number;
  /** Loose volume to order, after compaction & waste. */
  orderCubicYards: number;
  orderTons: number;
  orderPounds: number;
  /** Bag/bale equivalents for materials sold that way. */
  bales: number | null;
  /** ~2 cu ft bags — the home-store unit. */
  bagsTwoCuft: number;
  warnings: string[];
};

function areaFromShape(shape: ShapeMode): number | null {
  switch (shape.kind) {
    case "rectangle":
      if (shape.lengthFt <= 0 || shape.widthFt <= 0) return null;
      return shape.lengthFt * shape.widthFt;
    case "circle": {
      if (shape.diameterFt <= 0) return null;
      const r = shape.diameterFt / 2;
      return Math.PI * r * r;
    }
    case "triangle":
      if (shape.baseFt <= 0 || shape.heightFt <= 0) return null;
      return 0.5 * shape.baseFt * shape.heightFt;
    case "area":
      return shape.areaSqft > 0 ? shape.areaSqft : null;
    case "volume":
      return null;
  }
}

export function calculateMaterial(input: CalcInput): CalcResult {
  const material = MATERIAL_BY_KEY[input.materialKey] ?? null;
  const warnings: string[] = [];

  let finishedYd3 = 0;
  let areaSqft: number | null = null;

  if (input.shape.kind === "volume") {
    finishedYd3 = Math.max(0, input.shape.cubicYards);
  } else {
    areaSqft = areaFromShape(input.shape);
    if (areaSqft == null || input.depthIn <= 0) {
      finishedYd3 = 0;
    } else {
      // ft² × (in / 12) = ft³, then / 27 = yd³
      const ft3 = areaSqft * (input.depthIn / 12);
      finishedYd3 = ft3 / 27;
    }
  }

  const compaction = material?.compactionFactor ?? 1;
  const waste = Math.max(0, Math.min(input.wastePct, 50)) / 100;
  const orderYd3 = finishedYd3 * compaction * (1 + waste);

  const lbsPerYard = material?.lbsPerYard ?? 0;
  const orderLbs = orderYd3 * lbsPerYard;
  const orderTons = orderLbs / 2000;

  // Pine straw is the special bagged/baled case.
  let bales: number | null = null;
  if (material?.key === "pine_straw_bale") {
    if (areaSqft != null && areaSqft > 0) {
      // The bale heuristic assumes ~3" coverage. Scale linearly with depth.
      const depthFactor = input.depthIn / 3;
      bales = Math.ceil((areaSqft / PINE_STRAW_SQFT_PER_BALE) * Math.max(depthFactor, 0.5));
    } else {
      bales = 0;
    }
  }

  // 2 cu ft bag count — the unit most retail stores sell mulch/soil in.
  // 1 yd³ ≈ 13.5 bags.
  const bagsTwoCuft = Math.ceil(orderYd3 * 13.5);

  if (material && material.compactionFactor > 1) {
    warnings.push(
      `${material.name} compacts ~${Math.round((material.compactionFactor - 1) * 100)}% — loose order volume is already padded above the finished volume.`,
    );
  }
  if (material?.category === "soil_fill" && input.depthIn > 12) {
    warnings.push(
      "Deep fills should be placed and compacted in 6\"–8\" lifts. Order accordingly per lift.",
    );
  }
  if (material?.key === "silica_infill") {
    warnings.push(
      "Turf infill is normally specified in lb/sq ft (1.5–2 lb/ft²), not depth. Treat this result as a rough estimate only.",
    );
  }
  if (areaSqft != null && areaSqft > 5000) {
    warnings.push("Areas over 5,000 sq ft typically need to be staged across multiple deliveries.");
  }

  return {
    material,
    areaSqft,
    finishedCubicYards: round(finishedYd3, 2),
    orderCubicYards: round(orderYd3, 2),
    orderTons: round(orderTons, 2),
    orderPounds: Math.round(orderLbs),
    bales,
    bagsTwoCuft,
    warnings,
  };
}

function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
