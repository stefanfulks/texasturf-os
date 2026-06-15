'use server';

import { salesDb } from '@/lib/sales/db';
import { searchJobberClients } from '@/lib/sales/queries';
import { revalidatePath } from 'next/cache';
import type { Stage, StageTask } from '@/lib/sales/types';

const nowIso = () => new Date().toISOString();

export async function moveDealStage(dealId: string, stage: Stage) {
  const sb = await salesDb();
  const closed = stage === 'closed_won' || stage === 'closed_lost';
  await sb
    .from('deals')
    .update({
      stage,
      stage_entered_at: nowIso(),
      closed_at: closed ? nowIso() : null,
      updated_at: nowIso(),
    })
    .eq('id', dealId);
  await sb.from('deal_activities').insert({
    deal_id: dealId,
    kind: 'stage_change',
    body: `Moved to ${stage.replace(/_/g, ' ')}`,
  });
  revalidatePath(`/sales/deals/${dealId}`);
  revalidatePath('/sales');
  revalidatePath('/dashboard');
}

export async function addNote(dealId: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const sb = await salesDb();
  await sb.from('deal_activities').insert({ deal_id: dealId, kind: 'note', body: text });
  revalidatePath(`/sales/deals/${dealId}`);
}

export async function setNextStep(
  dealId: string,
  nextStep: string | null,
  nextStepDate: string | null,
) {
  const sb = await salesDb();
  await sb
    .from('deals')
    .update({ next_step: nextStep, next_step_date: nextStepDate, updated_at: nowIso() })
    .eq('id', dealId);
  revalidatePath(`/sales/deals/${dealId}`);
}

export async function toggleStageTask(
  dealId: string,
  stageTasks: Partial<Record<Stage, StageTask[]>>,
) {
  const sb = await salesDb();
  await sb
    .from('deals')
    .update({ stage_tasks: stageTasks, updated_at: nowIso() })
    .eq('id', dealId);
  revalidatePath(`/sales/deals/${dealId}`);
}

/** Server-action wrapper so client components (JobberHandoff) can search Jobber. */
export async function searchJobberClientsAction(
  query: string,
): Promise<{ id: string; name: string }[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return searchJobberClients(q);
}

export async function linkJobberClient(dealId: string, jobberClientId: string) {
  const sb = await salesDb();
  await sb
    .from('deals')
    .update({ jobber_client_id: jobberClientId, updated_at: nowIso() })
    .eq('id', dealId);
  revalidatePath(`/sales/deals/${dealId}`);
}

export interface NewContactInput {
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  segment?: string | null;
  city?: string | null;
  source?: string | null;
}

export interface NewDealInput {
  name: string;
  value_usd?: number | null;
  service_line?: string | null;
  expected_close_date?: string | null;
  next_step?: string | null;
  contact?: NewContactInput | null;
  jobber_client_id?: string | null;
}

/** Create a deal, optionally creating its prospect contact in the same call. */
export async function createDeal(input: NewDealInput): Promise<string | null> {
  const sb = await salesDb();
  let salesContactId: string | null = null;

  if (input.contact) {
    const { data: contact } = await sb
      .from('sales_contacts')
      .insert({
        name: input.contact.name,
        company: input.contact.company ?? null,
        phone: input.contact.phone ?? null,
        email: input.contact.email ?? null,
        segment: input.contact.segment ?? null,
        city: input.contact.city ?? null,
        source: input.contact.source ?? null,
      })
      .select('id')
      .single();
    salesContactId = (contact as { id: string } | null)?.id ?? null;
  }

  const { data: deal } = await sb
    .from('deals')
    .insert({
      name: input.name,
      stage: 'lead',
      value_usd: input.value_usd ?? null,
      service_line: input.service_line ?? null,
      expected_close_date: input.expected_close_date ?? null,
      next_step: input.next_step ?? null,
      sales_contact_id: salesContactId,
      jobber_client_id: input.jobber_client_id ?? null,
    })
    .select('id')
    .single();

  revalidatePath('/sales');
  return (deal as { id: string } | null)?.id ?? null;
}
