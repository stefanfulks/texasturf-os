/**
 * Sync Jobber invoices into the local mirror (public.jobber_invoices).
 *
 * syncAllInvoices() — paginated bulk pull. Used by the cron seed/refresh.
 * syncInvoice()    — single-record pull. Triggered by the webhook handler
 *                    on INVOICE_CREATE / INVOICE_UPDATE.
 *
 * Field set verified against the live API (version 2026-04-22) via
 * introspection + a real query on 2026-07-10: amounts exposes dollar
 * floats (total, invoiceBalance, depositAmount, paymentsTotal);
 * invoiceStatus arrives lowercase ("paid").
 */

import { gql } from "graphql-request";
import { jobberClient, jobberQuery } from "@/lib/jobber/graphql";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INVOICE_FIELDS = gql`
  fragment InvoiceFields on Invoice {
    id
    invoiceNumber
    subject
    invoiceStatus
    amounts { total invoiceBalance depositAmount paymentsTotal }
    issuedDate
    dueDate
    receivedDate
    createdAt
    updatedAt
    client { id }
  }
`;

const ALL_INVOICES = gql`
  ${INVOICE_FIELDS}
  query AllInvoices($cursor: String) {
    invoices(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes { ...InvoiceFields }
    }
  }
`;

const ONE_INVOICE = gql`
  ${INVOICE_FIELDS}
  query OneInvoice($id: EncodedId!) {
    invoice(id: $id) { ...InvoiceFields }
  }
`;

type GqlInvoice = {
  id: string;
  invoiceNumber: string | null;
  subject: string | null;
  invoiceStatus: string | null;
  amounts: {
    total: number | null;
    invoiceBalance: number | null;
    depositAmount: number | null;
    paymentsTotal: number | null;
  } | null;
  issuedDate: string | null;
  dueDate: string | null;
  receivedDate: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string } | null;
};

const toCents = (dollars: number | null | undefined) =>
  dollars == null ? null : Math.round(dollars * 100);

function toRow(accountId: string, i: GqlInvoice) {
  return {
    id:                   i.id,
    jobber_account_id:    accountId,
    invoice_number:       i.invoiceNumber,
    subject:              i.subject,
    status:               i.invoiceStatus,
    total_cents:          toCents(i.amounts?.total),
    balance_cents:        toCents(i.amounts?.invoiceBalance),
    deposit_cents:        toCents(i.amounts?.depositAmount),
    payments_total_cents: toCents(i.amounts?.paymentsTotal),
    issued_date:          i.issuedDate,
    due_date:             i.dueDate,
    received_date:        i.receivedDate,
    client_id:            i.client?.id ?? null,
    jobber_created_at:    i.createdAt,
    jobber_updated_at:    i.updatedAt,
    raw:                  i,
    synced_at:            new Date().toISOString(),
  };
}

export async function syncAllInvoices(accountId: string) {
  const client = await jobberClient(accountId);
  const supa = supabaseAdmin();
  type Resp = {
    invoices: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: GqlInvoice[];
    };
  };
  let cursor: string | null = null;
  let total = 0;
  do {
    const resp: Resp = await jobberQuery<Resp>(client, ALL_INVOICES, { cursor });
    const rows = resp.invoices.nodes.map((n) => toRow(accountId, n));
    if (rows.length > 0) {
      const { error } = await supa
        .from("jobber_invoices")
        .upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      total += rows.length;
    }
    cursor = resp.invoices.pageInfo.hasNextPage ? resp.invoices.pageInfo.endCursor : null;
  } while (cursor);
  return total;
}

export async function syncInvoice(accountId: string, invoiceId: string) {
  const client = await jobberClient(accountId);
  const resp = await jobberQuery<{ invoice: GqlInvoice | null }>(
    client,
    ONE_INVOICE,
    { id: invoiceId },
  );
  if (!resp.invoice) return;
  const { error } = await supabaseAdmin()
    .from("jobber_invoices")
    .upsert(toRow(accountId, resp.invoice), { onConflict: "id" });
  if (error) throw new Error(error.message);
}
