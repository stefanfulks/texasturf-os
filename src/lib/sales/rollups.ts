import type { Deal, ServiceLine } from './types';
import { STAGE_WEIGHTS } from './labels';
import { addDays, daysBetween, monthKey } from './dates';

const isOpen = (d: Deal) => d.stage !== 'closed_won' && d.stage !== 'closed_lost';
const isWon = (d: Deal) => d.stage === 'closed_won';
const isLost = (d: Deal) => d.stage === 'closed_lost';
const val = (d: Deal) => d.value_usd ?? 0;

export function openPipelineValue(deals: Deal[]): number {
  return deals.filter(isOpen).reduce((sum, d) => sum + val(d), 0);
}

export function weightedPipeline(deals: Deal[]): number {
  return deals
    .filter(isOpen)
    .reduce((sum, d) => sum + val(d) * (STAGE_WEIGHTS[d.stage] ?? 0), 0);
}

/** Won / (won + lost) among deals closed within the trailing window. 0 when empty. */
export function winRate(deals: Deal[], windowDays: number, now: string): number {
  const inWindow = deals.filter(
    (d) =>
      d.closed_at != null &&
      (isWon(d) || isLost(d)) &&
      daysBetween(d.closed_at, now) <= windowDays &&
      daysBetween(d.closed_at, now) >= 0,
  );
  if (!inWindow.length) return 0;
  return inWindow.filter(isWon).length / inWindow.length;
}

/** Open value expected to close in the current calendar month. */
export function closingThisMonth(deals: Deal[], now: string): number {
  const month = monthKey(now);
  return deals
    .filter(isOpen)
    .filter((d) => d.expected_close_date != null && monthKey(d.expected_close_date) === month)
    .reduce((sum, d) => sum + val(d), 0);
}

/** Trailing `months` of won revenue, ascending, zero-filled. */
export function wonByMonth(
  deals: Deal[],
  months: number,
  now: string,
): { month: string; value: number }[] {
  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    buckets.set(monthKey(addDays(now, -i * 30)), 0);
  }
  for (const d of deals) {
    if (!isWon(d) || d.closed_at == null) continue;
    const key = monthKey(d.closed_at);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + val(d));
  }
  return [...buckets.entries()].map(([month, value]) => ({ month, value }));
}

export function revenueByServiceLine(deals: Deal[]): { serviceLine: ServiceLine; value: number }[] {
  const sums = new Map<ServiceLine, number>();
  for (const d of deals) {
    if (!isWon(d) || d.service_line == null) continue;
    sums.set(d.service_line, (sums.get(d.service_line) ?? 0) + val(d));
  }
  return [...sums.entries()]
    .map(([serviceLine, value]) => ({ serviceLine, value }))
    .sort((a, b) => b.value - a.value);
}

/** Won value + count per owner id, descending. */
export function ownerLeaderboard(
  deals: Deal[],
  ownerIds: string[],
): { ownerId: string; value: number; count: number }[] {
  return ownerIds
    .map((ownerId) => {
      const won = deals.filter((d) => isWon(d) && d.owner_id === ownerId);
      return { ownerId, value: won.reduce((s, d) => s + val(d), 0), count: won.length };
    })
    .sort((a, b) => b.value - a.value);
}
