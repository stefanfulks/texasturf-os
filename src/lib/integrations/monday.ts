import type { IntegrationResult } from "./types";
import type { Invoice, InvoiceStatus } from "@/lib/database.types";

const MONDAY_API_KEY      = process.env.MONDAY_API_KEY;
const MONDAY_BOARD_ID     = process.env.MONDAY_INVOICE_BOARD_ID;
const MONDAY_API_URL      = "https://api.monday.com/v2";

// Map app invoice status → Monday status label
const STATUS_MAP: Partial<Record<InvoiceStatus, string>> = {
  submitted:          "Awaiting Approval",
  awaiting_review:    "Awaiting Approval",
  awaiting_approval:  "Awaiting Approval",
  approved:           "Approved",
  request_change:     "Request Change",
  paid:               "Paid",
  rejected:           "Request Change",
};

async function mondayQuery(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MONDAY_API_KEY}`,
      "Content-Type":  "application/json",
      "API-Version":   "2024-01",
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<{ data?: unknown; errors?: unknown[] }>;
}

export async function createMondayItem(invoice: Invoice & { vendorName?: string }): Promise<IntegrationResult> {
  if (!MONDAY_API_KEY || !MONDAY_BOARD_ID) {
    console.log(`[Monday mock] create item: ${invoice.title}`);
    return { success: true, message: "Monday not configured — logged only" };
  }

  try {
    const columnValues = JSON.stringify({
      numbers: invoice.total_amount?.toString() ?? "",
      date4:   invoice.service_period_start ? { date: invoice.service_period_start } : null,
      date5:   invoice.service_period_end   ? { date: invoice.service_period_end }   : null,
      status:  { label: STATUS_MAP[invoice.status] ?? "Awaiting Approval" },
      text:    invoice.vendorName ?? "",
    });

    const mutation = `
      mutation ($board: ID!, $name: String!, $vals: JSON!) {
        create_item(board_id: $board, item_name: $name, column_values: $vals) {
          id
        }
      }
    `;

    const result = await mondayQuery(mutation, {
      board: MONDAY_BOARD_ID,
      name:  invoice.title,
      vals:  columnValues,
    }) as { data?: { create_item?: { id: string } } };

    const itemId = result.data?.create_item?.id;
    if (!itemId) return { success: false, error: "Monday did not return item ID" };

    return { success: true, externalId: itemId, message: "Created Monday item" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateMondayItem(
  mondayItemId: string,
  invoice: Invoice,
): Promise<IntegrationResult> {
  if (!MONDAY_API_KEY || !MONDAY_BOARD_ID) {
    console.log(`[Monday mock] update item ${mondayItemId} → ${invoice.status}`);
    return { success: true, message: "Monday not configured — logged only" };
  }

  try {
    const columnValues = JSON.stringify({
      status: { label: STATUS_MAP[invoice.status] ?? "Awaiting Approval" },
      date6:  invoice.status_changed_at ? { date: invoice.status_changed_at.slice(0, 10) } : null,
    });

    const mutation = `
      mutation ($board: ID!, $item: ID!, $vals: JSON!) {
        change_multiple_column_values(board_id: $board, item_id: $item, column_values: $vals) {
          id
        }
      }
    `;

    await mondayQuery(mutation, {
      board: MONDAY_BOARD_ID,
      item:  mondayItemId,
      vals:  columnValues,
    });

    return { success: true, message: "Updated Monday item" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
