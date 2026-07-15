import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAudits } from "./audits";
import { AuditView } from "./audit-view";

export const metadata = { title: "Tracking QA · Marketing · TexasTurf OS" };

export default async function TrackingQaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const audits = getAudits();
  const latest = audits[0] ?? null;

  if (!latest) {
    return (
      <div className="space-y-5">
        <div>
          <p className="eyebrow mb-2">Marketing · Tracking QA</p>
          <h1 className="page-title">Meta Ads tracking QA</h1>
        </div>
        <div className="panel p-6">
          <div className="flex items-start gap-3">
            <span className="medallion medallion-warn !h-8 !w-8">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <p className="text-sm text-ink-2">
              No audits recorded yet. The first weekly snapshot will appear here once it’s generated.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <AuditView audit={latest} history={audits.slice(1)} />;
}
