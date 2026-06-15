// App-facing sales types. Hand-written (not derived from generated DB types) so
// the module compiles before the migration is applied, and so the stage_tasks
// jsonb has a precise shape rather than the generator's opaque Json.

export type Stage =
  | 'lead' | 'qualified' | 'site_visit' | 'quote_sent'
  | 'negotiation' | 'closed_won' | 'closed_lost';

export type ServiceLine =
  | 'backyard_install' | 'putting_green' | 'pet_area' | 'full_landscape'
  | 'model_home' | 'duplex_package' | 'pool_partner' | 'commercial' | 'hoa_amenity';

export type Segment = 'A' | 'B' | 'C' | 'D' | 'E' | 'R';
export type Health = 'green' | 'amber' | 'red';
export type RiskKind = 'stalling' | 'no_next_step' | 'past_close' | 'gone_quiet';
export interface RiskFlag { kind: RiskKind; label: string; }

export interface StageTask { id: string; label: string; done: boolean; }

export interface Deal {
  id: string;
  name: string;
  stage: Stage;
  value_usd: number | null;
  service_line: ServiceLine | null;
  sqft: number | null;
  expected_close_date: string | null;
  next_step: string | null;
  next_step_date: string | null;
  notes: string | null;
  stage_tasks: Partial<Record<Stage, StageTask[]>>;
  owner_id: string | null;
  sales_contact_id: string | null;
  jobber_client_id: string | null;
  stage_entered_at: string;
  closed_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesContact {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  segment: Segment | null;
  city: string | null;
  source: string | null;
  notes: string | null;
  jobber_client_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  kind: 'note' | 'call' | 'sms' | 'email' | 'site_visit' | 'stage_change' | 'task';
  body: string | null;
  direction: 'inbound' | 'outbound' | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_by: string | null;
}
