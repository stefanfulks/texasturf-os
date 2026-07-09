import { FileText } from "lucide-react";

export default function TurfcasaQuotesPage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">TurfCasa</p>
        <h1 className="page-title">Quotes</h1>
        <p className="mt-1 text-sm text-ink-2">
          Jobber-style quotes for materials: line items, discounts, deposit, and tax — with the
          accessory basket suggested on every turf quote.
        </p>
      </div>
      <div className="panel">
        <div className="empty-state">
          <span className="medallion medallion-warn"><FileText className="h-5 w-5" /></span>
          <p className="empty-state-title">Quoting is the next build</p>
          <p className="empty-state-body">
            Draft → sent → approved → converted, modeled on how TexasTurf actually uses Jobber
            (50% deposits, negative-line discounts, 8.25% default tax) minus the installation machinery.
          </p>
        </div>
      </div>
    </div>
  );
}
