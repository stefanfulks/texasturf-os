import type { Deal, DealActivity, Health, RiskFlag } from './types';
import { STAGE_LABELS, STALE_THRESHOLDS } from './labels';
import { daysBetween } from './dates';

export interface DealAssessment {
  flags: RiskFlag[];
  health: Health;
}

const QUIET_DAYS = 14;

/**
 * Deterministic deal-health rules. Pure: state in, assessment out.
 * Closed deals are always clean. `now` is an ISO date (YYYY-MM-DD).
 */
export function assessDeal(
  deal: Deal,
  activities: DealActivity[],
  now: string,
): DealAssessment {
  if (deal.stage === 'closed_won' || deal.stage === 'closed_lost') {
    return { flags: [], health: 'green' };
  }

  const flags: RiskFlag[] = [];

  const daysInStage = daysBetween(deal.stage_entered_at, now);
  const threshold = STALE_THRESHOLDS[deal.stage];
  if (threshold != null && daysInStage > threshold) {
    flags.push({ kind: 'stalling', label: `${daysInStage} days in ${STAGE_LABELS[deal.stage]}` });
  }

  if (deal.stage !== 'lead' && !deal.next_step) {
    flags.push({ kind: 'no_next_step', label: 'No next step set' });
  }

  if (deal.expected_close_date && daysBetween(deal.expected_close_date, now) > 0) {
    flags.push({ kind: 'past_close', label: 'Close date passed' });
  }

  const dealActivities = activities.filter((a) => a.deal_id === deal.id);
  const lastTouch = dealActivities.reduce<string | null>(
    (latest, a) => (latest == null || a.occurred_at > latest ? a.occurred_at : latest),
    null,
  );
  const quietDays = lastTouch == null ? Infinity : daysBetween(lastTouch, now);
  if (quietDays >= QUIET_DAYS) {
    flags.push({
      kind: 'gone_quiet',
      label: lastTouch == null ? 'No activity logged' : `No activity in ${quietDays} days`,
    });
  }

  const health: Health = flags.length === 0 ? 'green' : flags.length === 1 ? 'amber' : 'red';
  return { flags, health };
}
