import { Receipt } from "lucide-react";

export default function TurfcasaInvoicesPage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">TurfCasa</p>
        <h1 className="page-title">Invoices</h1>
        <p className="mt-1 text-sm text-ink-2">
          Customer invoices for the outlet: quote-to-invoice conversion, deposit credit, balances,
          and payment records.
        </p>
      </div>
      <div className="panel">
        <div className="empty-state">
          <span className="medallion medallion-warn"><Receipt className="h-5 w-5" /></span>
          <p className="empty-state-title">Invoicing ships right after quoting</p>
          <p className="empty-state-body">
            Statuses mirror the Jobber lifecycle — draft, awaiting payment, paid, past due,
            bad debt — with balance tracked as total minus payments.
          </p>
        </div>
      </div>
    </div>
  );
}
