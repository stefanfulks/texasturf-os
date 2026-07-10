/**
 * TurfCasa domain constants — order lifecycle, sources, fulfillment, catalog
 * labels. Values mirror the check constraints in the turfcasa_* migration;
 * change them together.
 */

export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "picking",
  "ready",
  "fulfilled",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new:       "New",
  confirmed: "Confirmed",
  picking:   "Picking",
  ready:     "Ready",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

/** Chip styling per status — house chip classes, amber for the active
 * warehouse states so the board reads at a glance. */
export const ORDER_STATUS_CHIP: Record<OrderStatus, string> = {
  new:       "chip chip-info",
  confirmed: "chip",
  picking:   "chip chip-warn",
  ready:     "chip chip-brand",
  fulfilled: "chip chip-brand",
  cancelled: "chip chip-danger",
};

/** The forward path a healthy order walks. Cancel is allowed from any
 * non-terminal state; no other backward/skip moves in v1. */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new:       "confirmed",
  confirmed: "picking",
  picking:   "ready",
  ready:     "fulfilled",
};

export const ORDER_SOURCES = ["website", "phone", "walk_in"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];
export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  website: "Website",
  phone:   "Phone",
  walk_in: "Walk-in",
};

export const FULFILLMENTS = ["will_call", "delivery"] as const;
export type Fulfillment = (typeof FULFILLMENTS)[number];
export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  will_call: "Will-call pickup",
  delivery:  "Delivery",
};

export const PRODUCT_CATEGORIES = [
  "turf",
  "pet_turf",
  "putting_green",
  "infill",
  "fastener",
  "adhesive",
  "edging",
  "ground_prep",
  "tool",
  "other",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  turf:          "Landscape turf",
  pet_turf:      "Pet turf",
  putting_green: "Putting green",
  infill:        "Infill",
  fastener:      "Fasteners",
  adhesive:      "Adhesives & tape",
  edging:        "Edging",
  ground_prep:   "Ground prep",
  tool:          "Tools",
  other:         "Other",
};

export const PRODUCT_UNITS = ["sqft", "linear_ft", "each", "box", "bag", "roll", "pallet"] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];
export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  sqft:      "sq ft",
  linear_ft: "linear ft",
  each:      "each",
  box:       "box",
  bag:       "bag",
  roll:      "roll",
  pallet:    "pallet",
};
