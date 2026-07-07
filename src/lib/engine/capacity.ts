/**
 * Capacity model — the app's FIRST. Crew throughput → installable sqft and
 * revenue per period. Consumed by the Goals & Pricing Strategy engine (a
 * revenue target you can't physically install is a flag, not a plan) and by
 * live utilization KPIs once schedule data wires in.
 *
 * Inputs come from fin_company_settings (crew_count, sqft_per_crew_day,
 * work_days_per_week) — 0 means ownership hasn't configured them yet, and
 * every result carries `configured: false` so downstream surfaces show
 * "needs setup" instead of silently computing zero capacity.
 */
import type { CapacityConfig } from "./config";

export type CapacitySummary = {
  configured: boolean;
  sqftPerWeek: number;
  sqftPerMonth: number;
  /** Annual installable sqft at the given working weeks per year. */
  sqftPerYear: number;
  workWeeksPerYear: number;
};

const WEEKS_PER_MONTH = 4.345;

export function computeCapacity(
  capacity: CapacityConfig,
  workWeeksPerYear = 50,
): CapacitySummary {
  const configured = capacity.crewCount > 0 && capacity.sqftPerCrewDay > 0;
  const sqftPerWeek = configured
    ? capacity.crewCount * capacity.sqftPerCrewDay * capacity.workDaysPerWeek
    : 0;
  return {
    configured,
    sqftPerWeek,
    sqftPerMonth: sqftPerWeek * WEEKS_PER_MONTH,
    sqftPerYear: sqftPerWeek * workWeeksPerYear,
    workWeeksPerYear,
  };
}

/** Revenue the crews can physically install in a year at a given average
 * realized price per sqft. The Goals engine compares this against the revenue
 * target and flags the gap (add crews / raise throughput / raise price). */
export function installableAnnualRevenue(
  summary: CapacitySummary,
  avgPricePerSqft: number,
): number | null {
  if (!summary.configured || avgPricePerSqft <= 0) return null;
  return summary.sqftPerYear * avgPricePerSqft;
}
