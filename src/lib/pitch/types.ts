export type TierKey = "silver" | "gold" | "platinum";

export type TierWarranty = {
  residential_years: number;
  commercial_years: number;
  prorated: boolean;
};

/** A tier resolved into the shape the pricing functions need. */
export type Tier = {
  key: string;
  name: string;
  sort: number;
  productLabel: string;   // client-facing product name
  pricingKey: string;     // cost key into pricing/data.ts
  targetMargin: number;
  infillMode: "standard" | "none";
  inclusions: string[];
  warranty: TierWarranty;
};

/** The job basics the salesperson enters once (private). */
export type BaseJob = {
  installedSqft: number;
  application: "soil" | "concrete";
  tearoutTier: string;
  access: "normal" | "difficult";
};

/** What the client is allowed to see. NO cogs / margin / commission. */
export type ClientPrice = {
  tier: string;
  name: string;
  productLabel: string;
  total: number | null;       // null => custom quote required
  perSqft: number | null;
  reviewRequired: boolean;
  inclusions: string[];
  warranty: TierWarranty;
};

export type ClientArea = { label: string; productLabel: string; sqft: number; price: number | null };
export type ClientAddon = { label: string; price: number };

/** Multi-area client-safe quote (Pitch v2). NEVER includes cogs / margin / commission. */
export type ClientQuoteV2 = {
  areas: ClientArea[];
  addons: ClientAddon[];
  total: number | null;        // null => any area needs a custom quote
  perSqft: number | null;
  warranty: TierWarranty;
  reviewRequired: boolean;
};

export type PitchSessionView = {
  id: string;
  prospectName: string | null;
  address: string | null;
  prices: ClientPrice[];          // legacy single-tier (back-compat)
  selectedTier: string | null;
  quoteV2: ClientQuoteV2 | null;  // v2 multi-area quote when built
};
