// Material density and depth defaults for the sales materials calculator.
//
// Densities are loose bulk weights — what gets delivered in a dump truck or
// scooped from a yard, not compacted in place. Numbers come from a survey of
// landscape-supply spec sheets (Kurtz Bros., Lyngso, Vulcan, SiteOne, USGA
// putting-green specs) cross-referenced with USDA NRCS soil weights and the
// FAO compost reference. Where sources disagreed we took the median and
// rounded to the nearest 25 lb/yd³.
//
// All densities are stored as pounds per cubic yard (lbs/yd³). 1 short
// ton = 2000 lb. 1 cubic yard = 27 cubic feet.

export type MaterialCategory =
  | "decorative_stone"
  | "gravel_base"
  | "sand"
  | "soil_fill"
  | "organic_mulch"
  | "compost_amendment"
  | "boulders";

export type Material = {
  key: string;
  name: string;
  category: MaterialCategory;
  /** Loose bulk density, lbs per cubic yard. */
  lbsPerYard: number;
  /** Typical install depth in inches. Used to seed the depth field. */
  defaultDepthIn: number;
  /** Recommended depth range — shown as a hint. */
  depthRangeIn: [number, number];
  /**
   * For compactable materials (DG, road base, screenings) the in-place volume
   * is smaller than the loose volume delivered. Multiplier > 1 means order
   * extra to hit the finished depth. 1.0 = no allowance.
   */
  compactionFactor: number;
  /** Sold by — typical unit at the yard. */
  soldBy: "ton" | "yard" | "both";
  /** Plain-language note shown under the picker. */
  note?: string;
};

export const MATERIALS: Material[] = [
  // ─── Decorative stone / river rock ───────────────────────────────────
  {
    key: "river_rock_1_3",
    name: "River Rock (1\"–3\")",
    category: "decorative_stone",
    lbsPerYard: 2800,
    defaultDepthIn: 3,
    depthRangeIn: [2, 4],
    compactionFactor: 1.0,
    soldBy: "both",
    note: "Most common decorative size. 2\" minimum to hide weed barrier; 3\" looks fuller.",
  },
  {
    key: "river_rock_3_6",
    name: "River Rock (3\"–6\")",
    category: "decorative_stone",
    lbsPerYard: 2900,
    defaultDepthIn: 4,
    depthRangeIn: [4, 6],
    compactionFactor: 1.0,
    soldBy: "both",
    note: "Larger decorative — drainage swales, dry creek beds.",
  },
  {
    key: "pea_gravel",
    name: "Pea Gravel (3/8\")",
    category: "decorative_stone",
    lbsPerYard: 2800,
    defaultDepthIn: 2,
    depthRangeIn: [2, 3],
    compactionFactor: 1.0,
    soldBy: "both",
    note: "Patios, playgrounds, walkways. Use steel edging or it migrates.",
  },
  {
    key: "lava_rock_red",
    name: "Lava Rock (red, 3/4\"–1.5\")",
    category: "decorative_stone",
    lbsPerYard: 1300,
    defaultDepthIn: 3,
    depthRangeIn: [2, 3],
    compactionFactor: 1.0,
    soldBy: "yard",
    note: "Lightweight — covers more area per ton than river rock.",
  },
  {
    key: "marble_chips",
    name: "Marble Chips / White Pebbles",
    category: "decorative_stone",
    lbsPerYard: 2800,
    defaultDepthIn: 2,
    depthRangeIn: [2, 3],
    compactionFactor: 1.0,
    soldBy: "both",
  },
  {
    key: "mexican_beach_pebble",
    name: "Mexican Beach Pebble",
    category: "decorative_stone",
    lbsPerYard: 2700,
    defaultDepthIn: 3,
    depthRangeIn: [2, 4],
    compactionFactor: 1.0,
    soldBy: "both",
    note: "Premium rounded black/grey stone. Sold by the bag too.",
  },
  {
    key: "cobble_4_8",
    name: "Cobble (4\"–8\")",
    category: "decorative_stone",
    lbsPerYard: 2800,
    defaultDepthIn: 6,
    depthRangeIn: [4, 8],
    compactionFactor: 1.0,
    soldBy: "ton",
  },

  // ─── Gravel / base / fines ───────────────────────────────────────────
  {
    key: "decomposed_granite",
    name: "Decomposed Granite (DG)",
    category: "gravel_base",
    lbsPerYard: 3000,
    defaultDepthIn: 3,
    depthRangeIn: [2, 4],
    compactionFactor: 1.25,
    soldBy: "both",
    note: "Paths/patios. Compacts ~20–25% — order ~1.25× the finished volume.",
  },
  {
    key: "stabilized_dg",
    name: "Stabilized DG (with binder)",
    category: "gravel_base",
    lbsPerYard: 3050,
    defaultDepthIn: 3,
    depthRangeIn: [2, 4],
    compactionFactor: 1.3,
    soldBy: "yard",
    note: "Pre-mixed with organic stabilizer (e.g. TechniSoil, Stabilizer Solutions).",
  },
  {
    key: "crushed_granite",
    name: "Crushed Granite (1/4\")",
    category: "gravel_base",
    lbsPerYard: 2700,
    defaultDepthIn: 3,
    depthRangeIn: [2, 4],
    compactionFactor: 1.2,
    soldBy: "both",
  },
  {
    key: "crushed_limestone",
    name: "Crushed Limestone (1/2\"–3/4\")",
    category: "gravel_base",
    lbsPerYard: 2700,
    defaultDepthIn: 4,
    depthRangeIn: [3, 6],
    compactionFactor: 1.15,
    soldBy: "both",
  },
  {
    key: "road_base",
    name: "Road Base / Crushed Concrete",
    category: "gravel_base",
    lbsPerYard: 2700,
    defaultDepthIn: 4,
    depthRangeIn: [3, 6],
    compactionFactor: 1.25,
    soldBy: "ton",
    note: "Sub-base under pavers, turf, concrete. Plan ~25% compaction.",
  },
  {
    key: "screenings_quarter_minus",
    name: "Granite Screenings (1/4\" minus)",
    category: "gravel_base",
    lbsPerYard: 2700,
    defaultDepthIn: 1,
    depthRangeIn: [0.5, 2],
    compactionFactor: 1.2,
    soldBy: "ton",
    note: "Paver setting bed / leveling course on top of road base.",
  },

  // ─── Sand ────────────────────────────────────────────────────────────
  {
    key: "mason_sand",
    name: "Mason Sand",
    category: "sand",
    lbsPerYard: 2700,
    defaultDepthIn: 1,
    depthRangeIn: [0.5, 2],
    compactionFactor: 1.0,
    soldBy: "both",
    note: "Fine — paver joints, mortar mixes, sandbox.",
  },
  {
    key: "concrete_sand",
    name: "Concrete / Bedding Sand",
    category: "sand",
    lbsPerYard: 2800,
    defaultDepthIn: 1,
    depthRangeIn: [1, 1.5],
    compactionFactor: 1.0,
    soldBy: "both",
    note: "ASTM C-33 paver setting bed; also used under turf in some specs.",
  },
  {
    key: "play_sand",
    name: "Play Sand (washed)",
    category: "sand",
    lbsPerYard: 2500,
    defaultDepthIn: 6,
    depthRangeIn: [4, 12],
    compactionFactor: 1.0,
    soldBy: "both",
  },
  {
    key: "fill_sand",
    name: "Fill Sand",
    category: "sand",
    lbsPerYard: 2700,
    defaultDepthIn: 4,
    depthRangeIn: [2, 12],
    compactionFactor: 1.1,
    soldBy: "both",
  },
  {
    key: "silica_infill",
    name: "Silica Infill (turf)",
    category: "sand",
    lbsPerYard: 2700,
    defaultDepthIn: 0.4,
    depthRangeIn: [0.25, 0.5],
    compactionFactor: 1.0,
    soldBy: "ton",
    note: "Turf infill is normally specced lbs/sqft (1.5–2 lb/ft²), not depth. Use the lbs/sqft mode.",
  },

  // ─── Soil / fill ─────────────────────────────────────────────────────
  {
    key: "topsoil_screened",
    name: "Topsoil (screened)",
    category: "soil_fill",
    lbsPerYard: 2000,
    defaultDepthIn: 4,
    depthRangeIn: [2, 6],
    compactionFactor: 1.0,
    soldBy: "yard",
    note: "Weight varies wildly with moisture — wet topsoil can hit 2,400 lb/yd³.",
  },
  {
    key: "garden_mix",
    name: "Garden Mix (topsoil + compost)",
    category: "soil_fill",
    lbsPerYard: 1800,
    defaultDepthIn: 6,
    depthRangeIn: [4, 12],
    compactionFactor: 1.0,
    soldBy: "yard",
    note: "Raised beds. Order 10–15% extra to account for settling.",
  },
  {
    key: "fill_dirt",
    name: "Fill Dirt (unscreened)",
    category: "soil_fill",
    lbsPerYard: 2400,
    defaultDepthIn: 12,
    depthRangeIn: [6, 36],
    compactionFactor: 1.25,
    soldBy: "yard",
    note: "Compactable — order ~25% over finished volume for grading work.",
  },
  {
    key: "sandy_loam",
    name: "Sandy Loam",
    category: "soil_fill",
    lbsPerYard: 2200,
    defaultDepthIn: 4,
    depthRangeIn: [2, 8],
    compactionFactor: 1.0,
    soldBy: "yard",
    note: "Common base for sod and turf install.",
  },
  {
    key: "putting_green_mix",
    name: "USGA Putting-Green Mix (sand/peat)",
    category: "soil_fill",
    lbsPerYard: 2600,
    defaultDepthIn: 4,
    depthRangeIn: [4, 6],
    compactionFactor: 1.05,
    soldBy: "yard",
  },

  // ─── Organic mulches ─────────────────────────────────────────────────
  {
    key: "hardwood_mulch",
    name: "Hardwood Mulch (double-shredded)",
    category: "organic_mulch",
    lbsPerYard: 900,
    defaultDepthIn: 3,
    depthRangeIn: [2, 4],
    compactionFactor: 1.0,
    soldBy: "yard",
    note: "Most popular. Decomposes in 1–2 yrs; refresh ~1\" annually.",
  },
  {
    key: "dyed_brown_mulch",
    name: "Dyed Brown Mulch",
    category: "organic_mulch",
    lbsPerYard: 900,
    defaultDepthIn: 3,
    depthRangeIn: [2, 3],
    compactionFactor: 1.0,
    soldBy: "yard",
  },
  {
    key: "dyed_black_mulch",
    name: "Dyed Black Mulch",
    category: "organic_mulch",
    lbsPerYard: 900,
    defaultDepthIn: 3,
    depthRangeIn: [2, 3],
    compactionFactor: 1.0,
    soldBy: "yard",
  },
  {
    key: "cedar_mulch",
    name: "Cedar Mulch",
    category: "organic_mulch",
    lbsPerYard: 650,
    defaultDepthIn: 3,
    depthRangeIn: [2, 4],
    compactionFactor: 1.0,
    soldBy: "yard",
    note: "Naturally bug-repellent; lighter & fluffier than hardwood.",
  },
  {
    key: "pine_bark_nuggets",
    name: "Pine Bark Nuggets",
    category: "organic_mulch",
    lbsPerYard: 600,
    defaultDepthIn: 3,
    depthRangeIn: [2, 4],
    compactionFactor: 1.0,
    soldBy: "yard",
  },
  {
    key: "pine_bark_fine",
    name: "Pine Bark Mulch (fine)",
    category: "organic_mulch",
    lbsPerYard: 650,
    defaultDepthIn: 3,
    depthRangeIn: [2, 4],
    compactionFactor: 1.0,
    soldBy: "yard",
  },
  {
    key: "pine_straw_bale",
    name: "Pine Straw (per bale, ~25 sq ft)",
    category: "organic_mulch",
    lbsPerYard: 0, // Sold by the bale — use a different unit mode.
    defaultDepthIn: 3,
    depthRangeIn: [2, 4],
    compactionFactor: 1.0,
    soldBy: "yard",
    note: "Sold by the bale (~25 sq ft of 3\" coverage). The calculator estimates bale count from area.",
  },
  {
    key: "cypress_mulch",
    name: "Cypress Mulch",
    category: "organic_mulch",
    lbsPerYard: 800,
    defaultDepthIn: 3,
    depthRangeIn: [2, 4],
    compactionFactor: 1.0,
    soldBy: "yard",
  },
  {
    key: "playground_chips",
    name: "Playground Wood Chips (engineered)",
    category: "organic_mulch",
    lbsPerYard: 700,
    defaultDepthIn: 9,
    depthRangeIn: [9, 12],
    compactionFactor: 1.15,
    soldBy: "yard",
    note: "ASTM F1292 fall-attenuation depth is 9\" minimum, then accounts for compaction.",
  },
  {
    key: "arborist_chips",
    name: "Arborist Wood Chips (rough)",
    category: "organic_mulch",
    lbsPerYard: 700,
    defaultDepthIn: 3,
    depthRangeIn: [3, 6],
    compactionFactor: 1.0,
    soldBy: "yard",
  },

  // ─── Compost / amendments ────────────────────────────────────────────
  {
    key: "compost_finished",
    name: "Compost (finished)",
    category: "compost_amendment",
    lbsPerYard: 1100,
    defaultDepthIn: 2,
    depthRangeIn: [1, 4],
    compactionFactor: 1.0,
    soldBy: "yard",
    note: "Topdressing rate is typically 0.5\"–1\" annually.",
  },
  {
    key: "mushroom_compost",
    name: "Mushroom Compost",
    category: "compost_amendment",
    lbsPerYard: 1000,
    defaultDepthIn: 2,
    depthRangeIn: [1, 3],
    compactionFactor: 1.0,
    soldBy: "yard",
  },
  {
    key: "leaf_mold",
    name: "Leaf Mold / Leaf Compost",
    category: "compost_amendment",
    lbsPerYard: 800,
    defaultDepthIn: 2,
    depthRangeIn: [1, 3],
    compactionFactor: 1.0,
    soldBy: "yard",
  },
  {
    key: "peat_moss",
    name: "Peat Moss (loose)",
    category: "compost_amendment",
    lbsPerYard: 500,
    defaultDepthIn: 1,
    depthRangeIn: [0.5, 2],
    compactionFactor: 1.0,
    soldBy: "yard",
  },

  // ─── Boulders ────────────────────────────────────────────────────────
  {
    key: "boulders_small",
    name: "Boulders (1'–2', ~150–500 lb)",
    category: "boulders",
    lbsPerYard: 3000,
    defaultDepthIn: 18,
    depthRangeIn: [12, 24],
    compactionFactor: 1.0,
    soldBy: "ton",
    note: "Sold by the ton at the pile. Ordering by weight, not volume.",
  },
  {
    key: "boulders_large",
    name: "Boulders (2'–4', ~500–2,000 lb)",
    category: "boulders",
    lbsPerYard: 3200,
    defaultDepthIn: 24,
    depthRangeIn: [24, 48],
    compactionFactor: 1.0,
    soldBy: "ton",
  },
];

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  decorative_stone: "Decorative Stone & River Rock",
  gravel_base: "Gravel, DG & Base",
  sand: "Sand",
  soil_fill: "Soil & Fill",
  organic_mulch: "Organic Mulch",
  compost_amendment: "Compost & Amendments",
  boulders: "Boulders",
};

export const MATERIAL_BY_KEY: Record<string, Material> = Object.fromEntries(
  MATERIALS.map((m) => [m.key, m]),
);

/** Pine straw heuristic — bales of 3" coverage per square foot. */
export const PINE_STRAW_SQFT_PER_BALE = 25;
