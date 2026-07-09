import { Users } from "lucide-react";

export default function TurfcasaAccountsPage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">TurfCasa</p>
        <h1 className="page-title">Trade Accounts</h1>
        <p className="mt-1 text-sm text-ink-2">
          Builders, landscapers, and contractors — pricing tier, Net-30 terms, and a named contact on every account.
        </p>
      </div>
      <div className="panel">
        <div className="empty-state">
          <span className="medallion medallion-warn"><Users className="h-5 w-5" /></span>
          <p className="empty-state-title">Trade accounts ship with the quoting build</p>
          <p className="empty-state-body">
            Account records, trade-pricing tiers, and enrollment land here as part of the
            TurfCasa quoting rollout — next item on the build list.
          </p>
        </div>
      </div>
    </div>
  );
}
