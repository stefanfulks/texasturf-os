import { redirect } from "next/navigation";
import { Megaphone, Search, Star, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SectionCard } from "@/components/section-card";

export const metadata = { title: "Marketing · TexasTurf OS" };

export default async function MarketingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Content, campaigns, SEO, reviews, and lead-source tracking.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6">
        <p className="text-sm text-zinc-700">
          Marketing Hub is on the roadmap. The plan: content calendar,
          campaign tracker, Google Search Console + Analytics integration,
          review monitor, and lead-source breakdown.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          For now, marketing work lives in Notion + Google Drive.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-60 pointer-events-none">
        <SectionCard
          href="#"
          title="Content calendar"
          description="Plan posts across IG, FB, Google, Email."
          icon={<Megaphone className="h-5 w-5" />}
          accent="purple"
        />
        <SectionCard
          href="#"
          title="SEO + keywords"
          description="Search Console impressions, rankings, page speed."
          icon={<Search className="h-5 w-5" />}
          accent="blue"
        />
        <SectionCard
          href="#"
          title="Reviews monitor"
          description="New Google reviews, average rating, response queue."
          icon={<Star className="h-5 w-5" />}
          accent="yellow"
        />
        <SectionCard
          href="#"
          title="Lead sources"
          description="Where do jobs come from? Google, referral, door-hangers."
          icon={<BarChart3 className="h-5 w-5" />}
          accent="emerald"
        />
      </div>
    </div>
  );
}
