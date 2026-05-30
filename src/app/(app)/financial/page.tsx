import { redirect } from "next/navigation";
import { BarChart3, DollarSign, TrendingUp, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SectionCard } from "@/components/section-card";

export const metadata = { title: "Financial · TexasTurf OS" };

export default async function FinancialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Optional: gate this section to admin role only — financials are sensitive.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financial</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Reports, budget, team performance, and (eventually) P&L + cash flow.
        </p>
      </div>

      {!isAdmin && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Some financial views are admin-only. Ask Stefan if you need access.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          href="/reports"
          title="Reports"
          description="Monthly overview, KPI dashboard, top vendors."
          icon={<BarChart3 className="h-5 w-5" />}
          accent="blue"
        />
        <SectionCard
          href="/reports/budget"
          title="Budget vs Actual"
          description="6 categories, monthly variance, edit per-month."
          icon={<DollarSign className="h-5 w-5" />}
          accent="emerald"
        />
        <SectionCard
          href="/reports/kpis"
          title="Manual KPIs"
          description="Capacity, satisfaction, lead time, margins."
          icon={<TrendingUp className="h-5 w-5" />}
          accent="purple"
        />
        <SectionCard
          href="/reports/team"
          title="Team Performance"
          description="Per-person KPI tracking and coaching reports."
          icon={<Users className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500">
        <p className="font-medium text-zinc-700">Coming soon</p>
        <p className="mt-1">P&L dashboard · job costing · cash flow forecast · AP aging · 1099 prep.</p>
      </div>
    </div>
  );
}
