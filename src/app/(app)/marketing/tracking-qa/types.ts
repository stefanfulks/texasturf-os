/**
 * Meta Ads tracking-QA audit — shared types.
 *
 * The page is presentational: it renders an already-computed `AuditSnapshot`.
 * Each week a new snapshot JSON is added under `./audits/` and wired into
 * `./audits/index.ts`. The snapshot carries its own flags so the thresholds
 * that produced them travel with the data (and stay auditable after the fact).
 *
 * Data source: Meta Ads (pixel signal quality + campaign entities), pulled
 * weekly via the Facebook Ads tools. No Meta credentials live in this app.
 */

export type Severity = "critical" | "warn" | "ok" | "info";

/** Event volume for the window, split by source (pre-dedup event counts). */
export type EventVolume = {
  event: string;
  web: number;
  server: number;
  total: number;
};

export type MatchKey = {
  /** email | phone | fbc | fbp | external_id | ip_address | user_agent */
  key: string;
  /** Coverage %, or null when the key is absent from the event. */
  coverage: number | null;
};

export type EmqRow = {
  event: string;
  /** Composite EMQ score (0–10), or null when Meta reports no EMQ at all. */
  composite: number | null;
  matchKeys: MatchKey[];
  /** Conversion events (Lead, Schedule, Purchase…) get flagged when weak. */
  isConversion: boolean;
  /** Optional per-event note (e.g. "no volume in window"). */
  note?: string;
};

export type AdSet = {
  name: string;
  /** ACTIVE | WITH_ISSUES | PAUSED | … (Meta effective_status). */
  status: string;
  optimizationGoal: string;
  spend: string | null;
  impressions: string | null;
  /** Meta-attributed leads — a number, or a raw string like "Not available". */
  attributedLeads: number | string;
};

export type Flag = {
  severity: Severity;
  title: string;
  detail: string;
};

export type AttributionGap = {
  window: string;
  /** Lead events counted at the pixel for the window. */
  pixelLeads: number;
  /** Website Leads Meta attributed to the campaign (usually 0 here). */
  metaAttributedLeads: number;
  /** Raw value Meta returned, e.g. "Not available". */
  metaAttributedRaw: string;
  /** Media buyer's manually-counted / "corrected" leads. Null until provided. */
  buyerCorrectedLeads: number | null;
};

export type AuditSnapshot = {
  /** Audit run date (YYYY-MM-DD) — used to sort and label the week. */
  weekEnding: string;
  windowLabel: string;
  windowStart: string;
  windowEnd: string;
  generatedAt: string;

  account: { name: string; id: string };

  pixel: {
    name: string;
    id: string;
    active: boolean;
    lastFired: string;
    lastFiredServer: string;
    uploadFrequency: string;
    /** Conversions API Gateway status, e.g. NOT_ONBOARDED. */
    capiGateway: string;
  };

  campaign: {
    name: string;
    id: string;
    objective: string;
    optimizedEvent: string;
    eventIsFiring: boolean;
    signalUsableByMeta: boolean;
    spend: string;
    impressions: string;
    attributionSetting: string;
  };

  eventVolume: EventVolume[];
  emq: EmqRow[];
  /** fbc (click-ID) coverage %, flagged under target. */
  fbcCoverage: number;
  fbcTarget: number;
  adSets: AdSet[];
  attributionGap: AttributionGap;
  flags: Flag[];
};
