import Link from "next/link";
import { redirect } from "next/navigation";
import { Calculator, Briefcase, Palette, ExternalLink, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SectionCard } from "@/components/section-card";

export const metadata = { title: "Sales · TexasTurf OS" };

const DESIGN_REQUEST_URL =
  "https://yourhavendesign.monday.com/boards/8534813124/views/220407625";

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
          href="/sales/materials-calculator"
          title="Materials Calculator"
          description="River rock, DG, mulch, soil — instant tons & cubic yards."
          icon={<Scale className="h-5 w-5" />}
          accent="green"
        />
        <SectionCard
          href="/projects"
          title="Projects"
          description="Active customer projects and bids."
          icon={<Briefcase className="h-5 w-5" />}
          accent="purple"
        />
        {/* External link — opens the Your Haven Design Monday board in a new tab. */}
        <Link
          href={DESIGN_REQUEST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-400 hover:shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Palette className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1">
              External
              <ExternalLink className="h-3 w-3" />
            </span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 group-hover:text-zinc-700">
              Request a Design
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500">
              File a new design request with the Your Haven Design team
              (opens their Monday board).
            </p>
          </div>
        </Link>
      </div>

      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500">
        <p className="font-medium text-zinc-700">Coming soon</p>
        <p className="mt-1">Lead tracker · quote history · commission ledger · Jobber integration.</p>
      </div>
    </div>
  );
}
