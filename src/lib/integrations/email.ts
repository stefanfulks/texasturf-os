import type { IntegrationResult } from "./types";
import type { Invoice, InvoiceStatus } from "@/lib/db-helpers.types";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.EMAIL_FROM ?? "noreply@texasturfusa.com";
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";

const STATUS_SUBJECT: Partial<Record<InvoiceStatus, string>> = {
  submitted:          "Invoice Received",
  awaiting_approval:  "Invoice Ready for Approval",
  approved:           "Invoice Approved",
  request_change:     "Invoice Needs Changes",
  paid:               "Invoice Marked Paid",
  rejected:           "Invoice Rejected",
};

function invoiceEmailHtml(invoice: Invoice & { vendorName?: string }, event: string, notes?: string) {
  const link   = `${APP_URL}/invoices/${invoice.id}`;
  const amount = invoice.total_amount != null
    ? `$${invoice.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : "—";

  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #18181b;">
      <h2 style="margin-bottom: 4px;">${event}</h2>
      <p style="color: #71717a; margin-top: 0;">${invoice.title}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px 0; color: #71717a; width: 40%;">Vendor</td><td>${invoice.vendorName ?? "—"}</td></tr>
        <tr><td style="padding: 8px 0; color: #71717a;">Amount</td><td>${amount}</td></tr>
        ${invoice.service_period_start ? `<tr><td style="padding: 8px 0; color: #71717a;">Service Period</td><td>${invoice.service_period_start}${invoice.service_period_end ? ` – ${invoice.service_period_end}` : ""}</td></tr>` : ""}
        <tr><td style="padding: 8px 0; color: #71717a;">Status</td><td>${invoice.status.replace(/_/g, " ")}</td></tr>
      </table>
      ${notes ? `<p style="background: #f4f4f5; padding: 12px; border-radius: 6px;">${notes}</p>` : ""}
      <a href="${link}" style="display: inline-block; background: #18181b; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 8px;">View Invoice</a>
    </div>
  `;
}

export async function sendInvoiceEmail(
  to: string | string[],
  invoice: Invoice & { vendorName?: string },
  notes?: string,
): Promise<IntegrationResult> {
  const event   = STATUS_SUBJECT[invoice.status] ?? "Invoice Update";
  const subject = `[TexasTurf] ${event}: ${invoice.title}`;

  if (!RESEND_API_KEY) {
    console.log(`[Email mock] To: ${Array.isArray(to) ? to.join(", ") : to} | Subject: ${subject}`);
    return { success: true, message: "Email not configured — logged only" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      Array.isArray(to) ? to : [to],
        subject,
        html:    invoiceEmailHtml(invoice, event, notes),
      }),
    });

    const data = await res.json() as { id?: string; name?: string; message?: string };
    if (!data.id) {
      return { success: false, error: data.message ?? "Email send failed" };
    }

    return { success: true, externalId: data.id, message: "Email sent" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
