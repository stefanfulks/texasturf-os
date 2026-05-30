import { redirect } from "next/navigation";
import { Calculator, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SectionCard } from "@/components/section-card";

export const metadata = { title: "Sales · TexasTurf OS" };

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Tools for quoting, lead tracking, and converting customers.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          href="/pricing"
          title="Pricing Calculator"
          description="Quote a job: COGS, margin, commission, company net — instantly."
          icon={<Calculator className="h-5 w-5" />}
          accent="blue"
        />
        <SectionCard
          href="/projects"
          title="Projects"
          description="Active customer projects and bids."
          icon={<Briefcase className="h-5 w-5" />}
          accent="purple"
        />
      </div>

      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500">
        <p className="font-medium text-zinc-700">Coming soon</p>
        <p className="mt-1">Lead tracker · quote history · commission ledger · Jobber integration.</p>
      </div>
    </div>
  );
}
