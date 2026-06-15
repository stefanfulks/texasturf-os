import { describe, expect, it } from 'vitest';
import { assessDeal } from '../risk';
import { addDays } from '../dates';
import type { Deal, DealActivity } from '../types';

const NOW = '2026-06-15';

const base: Deal = {
  id: 'd1',
  name: 'Test deal',
  stage: 'quote_sent',
  value_usd: 10000,
  service_line: 'backyard_install',
  sqft: null,
  expected_close_date: addDays(NOW, 30),
  next_step: 'Call Josh',
  next_step_date: NOW,
  notes: null,
  stage_tasks: {},
  owner_id: 'u1',
  sales_contact_id: 'c1',
  jobber_client_id: null,
  stage_entered_at: addDays(NOW, -3),
  closed_at: null,
  lost_reason: null,
  created_at: addDays(NOW, -20),
  updated_at: NOW,
};

const act = (daysAgo: number): DealActivity[] => [
  {
    id: 'a1', deal_id: 'd1', kind: 'email', body: 'touch',
    direction: null, metadata: {}, occurred_at: addDays(NOW, -daysAgo), created_by: 'u1',
  },
];

describe('assessDeal', () => {
  it('green when fresh, next step set, future close, recent activity', () => {
    expect(assessDeal(base, act(2), NOW)).toEqual({ flags: [], health: 'green' });
  });

  it('flags stalling past the stage threshold (quote_sent > 14d)', () => {
    const r = assessDeal({ ...base, stage_entered_at: addDays(NOW, -15) }, act(2), NOW);
    expect(r.flags.map((f) => f.kind)).toContain('stalling');
    expect(r.health).toBe('amber');
  });

  it('flags no_next_step for qualified+ but not for leads', () => {
    expect(assessDeal({ ...base, next_step: null }, act(2), NOW).flags.map((f) => f.kind)).toContain('no_next_step');
    expect(
      assessDeal({ ...base, stage: 'lead', stage_entered_at: addDays(NOW, -1), next_step: null }, act(1), NOW)
        .flags.map((f) => f.kind),
    ).not.toContain('no_next_step');
  });

  it('flags past_close and gone_quiet together → red', () => {
    const r = assessDeal({ ...base, expected_close_date: addDays(NOW, -1) }, act(20), NOW);
    expect(r.flags.map((f) => f.kind).sort()).toEqual(['gone_quiet', 'past_close']);
    expect(r.health).toBe('red');
  });

  it('no activity at all reads as gone quiet', () => {
    expect(assessDeal(base, [], NOW).flags.map((f) => f.kind)).toContain('gone_quiet');
  });

  it('closed deals never carry flags', () => {
    expect(assessDeal({ ...base, stage: 'closed_won', next_step: null }, [], NOW).flags).toEqual([]);
    expect(assessDeal({ ...base, stage: 'closed_lost' }, [], NOW).health).toBe('green');
  });
});
