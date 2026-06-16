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

export type PitchSessionView = {
  id: string;
  prospectName: string | null;
  address: string | null;
  prices: ClientPrice[];
  selectedTier: string | null;
};
