import { redirect } from "next/navigation";
import { FileText, Users, Truck, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SectionCard } from "@/components/section-card";

export const metadata = { title: "Office · TexasTurf OS" };

export default async function OfficePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [needsActionRes, vendorsRes, activeProjectsRes, fleetRes] = await Promise.all([
    supabase.from("invoices").select("id", { count: "exact", head: true })
      .in("status", ["awaiting_review","awaiting_approval","ocr_review_needed","request_change"]),
    supabase.from("vendors").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("projects").select("id", { count: "exact", head: true })
      .eq("archived", false)
      .not("status", "in", "(complete,cancelled)"),
    supabase.from("fleet_assets").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Office</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Invoices, vendors, projects, fleet — the back-office workhorse views.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          href="/invoices"
          title="Invoices"
          description="Submission, review, approval, and payment tracking."
          icon={<FileText className="h-5 w-5" />}
          badge={needsActionRes.count ?? null}
          accent={needsActionRes.count && needsActionRes.count > 0 ? "amber" : "neutral"}
        />
        <SectionCard
          href="/vendors"
          title="Vendors"
          description="Contractors, suppliers, and their scorecards."
          icon={<Users className="h-5 w-5" />}
          badge={vendorsRes.count ?? null}
          accent="blue"
        />
        <SectionCard
          href="/projects"
          title="Projects"
          description="Customer projects, internal initiatives, and SEO work."
          icon={<Briefcase className="h-5 w-5" />}
          badge={activeProjectsRes.count ?? null}
          accent="purple"
        />
        <SectionCard
          href="/fleet"
          title="Fleet & Equipment"
          description="Trucks, trailers, heavy equipment, maintenance."
          icon={<Truck className="h-5 w-5" />}
          badge={fleetRes.count ?? null}
          accent="green"
        />
      </div>
    </div>
  );
}
