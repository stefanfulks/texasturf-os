import { describe, expect, it } from 'vitest';
import {
  closingThisMonth, openPipelineValue, ownerLeaderboard,
  revenueByServiceLine, weightedPipeline, winRate, wonByMonth,
} from '../rollups';
import { addDays } from '../dates';
import type { Deal } from '../types';

const NOW = '2026-06-15';

function deal(patch: Partial<Deal>): Deal {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'D', stage: 'lead', value_usd: 1000, service_line: 'backyard_install', sqft: null,
    expected_close_date: addDays(NOW, 60), next_step: null, next_step_date: null, notes: null,
    stage_tasks: {}, owner_id: 'r1', sales_contact_id: 'c1', jobber_client_id: null,
    stage_entered_at: NOW, closed_at: null, lost_reason: null, created_at: NOW, updated_at: NOW,
    ...patch,
  };
}

const deals: Deal[] = [
  deal({ stage: 'lead', value_usd: 10000 }),
  deal({ stage: 'negotiation', value_usd: 20000, expected_close_date: addDays(NOW, 5) }),
  deal({ stage: 'quote_sent', value_usd: 5000, expected_close_date: addDays(NOW, 40) }),
  deal({ stage: 'closed_won', value_usd: 50000, service_line: 'putting_green', closed_at: addDays(NOW, -10), owner_id: 'r2' }),
  deal({ stage: 'closed_won', value_usd: 30000, service_line: 'backyard_install', closed_at: addDays(NOW, -100) }),
  deal({ stage: 'closed_lost', value_usd: 40000, closed_at: addDays(NOW, -20) }),
];

describe('rollups', () => {
  it('openPipelineValue sums only open deals', () => {
    expect(openPipelineValue(deals)).toBe(35000);
  });
  it('weightedPipeline applies stage weights', () => {
    expect(weightedPipeline(deals)).toBe(20000); // 10000*.1 + 20000*.8 + 5000*.6
  });
  it('winRate counts only deals closed in window', () => {
    expect(winRate(deals, 90, NOW)).toBe(0.5); // won(-10) + lost(-20) → 1/2
    expect(winRate(deals, 15, NOW)).toBe(1);    // only the -10 won
    expect(winRate(deals, 5, NOW)).toBe(0);
  });
  it('closingThisMonth sums open deals closing in the current month', () => {
    expect(closingThisMonth(deals, NOW)).toBe(20000); // +5d is June; +40d July; +60d Aug
  });
  it('wonByMonth returns ascending zero-filled months', () => {
    const rows = wonByMonth(deals, 4, NOW);
    expect(rows).toHaveLength(4);
    expect(rows[3].month).toBe('2026-06');
    expect(rows[3].value).toBe(50000);
    expect(rows[0].month).toBe('2026-03');
    expect(rows[0].value).toBe(30000);
  });
  it('revenueByServiceLine ranks won revenue desc', () => {
    expect(revenueByServiceLine(deals)).toEqual([
      { serviceLine: 'putting_green', value: 50000 },
      { serviceLine: 'backyard_install', value: 30000 },
    ]);
  });
  it('ownerLeaderboard ranks won value by owner', () => {
    expect(ownerLeaderboard(deals, ['r1', 'r2', 'r3'])).toEqual([
      { ownerId: 'r2', value: 50000, count: 1 },
      { ownerId: 'r1', value: 30000, count: 1 },
      { ownerId: 'r3', value: 0, count: 0 },
    ]);
  });
});
