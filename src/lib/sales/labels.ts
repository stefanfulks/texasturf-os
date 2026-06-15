import type { Stage, ServiceLine, Segment } from './types';

export const OPEN_STAGES: Stage[] = ['lead', 'qualified', 'site_visit', 'quote_sent', 'negotiation'];

export const STAGE_LABELS: Record<Stage, string> = {
  lead: 'Lead', qualified: 'Qualified', site_visit: 'Site Visit', quote_sent: 'Quote Sent',
  negotiation: 'Negotiation', closed_won: 'Closed Won', closed_lost: 'Closed Lost',
};

export const SERVICE_LINE_LABELS: Record<ServiceLine, string> = {
  backyard_install: 'Backyard install', putting_green: 'Putting green', pet_area: 'Pet area',
  full_landscape: 'Full landscape', model_home: 'Model home', duplex_package: 'Duplex package',
  pool_partner: 'Pool partner', commercial: 'Commercial', hoa_amenity: 'HOA amenity',
};

export const SEGMENT_LABELS: Record<Segment, string> = {
  A: 'Builders & Developers', B: 'Commercial Property', C: 'HOA & Community',
  D: 'Designers & Architects', E: 'Landscape Construction', R: 'Residential',
};

export const STAGE_WEIGHTS: Record<string, number> = {
  lead: 0.1, qualified: 0.25, site_visit: 0.4, quote_sent: 0.6, negotiation: 0.8,
};

/** Days a deal may sit in a stage before it reads as stalling. */
export const STALE_THRESHOLDS: Record<string, number> = {
  lead: 7, qualified: 10, site_visit: 10, quote_sent: 14, negotiation: 14,
};

export const STAGE_TASK_TEMPLATES: Record<Stage, string[]> = {
  lead: ['Confirm contact info', 'Log lead source', 'Make first touch'],
  qualified: ['Budget range confirmed', 'Decision maker identified', 'Timeline known'],
  site_visit: ['Schedule walkthrough', 'Measure & photograph', 'Grade & access notes', 'HOA / utility constraints'],
  quote_sent: ['Takeoff complete', 'Design attached if needed', 'Proposal sent', 'Follow-up scheduled'],
  negotiation: ['Objections logged', 'Revised quote if needed', 'Verbal commit', 'Contract sent'],
  closed_won: [], closed_lost: [],
};
