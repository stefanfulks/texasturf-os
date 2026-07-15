import type { AuditSnapshot } from "../types";
import week_2026_07_15 from "./2026-07-15.json";

/**
 * Weekly Meta Ads tracking-QA snapshots.
 *
 * To add a week: drop a `YYYY-MM-DD.json` next to this file (see README.md),
 * import it here, and add it to the array below. Order does not matter —
 * `getAudits()` sorts by weekEnding descending.
 */
const SNAPSHOTS = [week_2026_07_15] as unknown as AuditSnapshot[];

export function getAudits(): AuditSnapshot[] {
  return [...SNAPSHOTS].sort((a, b) => b.weekEnding.localeCompare(a.weekEnding));
}

export function getLatestAudit(): AuditSnapshot | null {
  return getAudits()[0] ?? null;
}
