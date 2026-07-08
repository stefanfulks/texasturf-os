import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Gift, Film, CalendarDays, CalendarRange, FolderTree, Sparkles, Target,
  ArrowUpRight, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getContent } from "@/lib/content/load";
import { RichText, RichList } from "@/lib/content/rich-text";

export const metadata = { title: "Marketing Playbook · TexasTurf OS" };

function Section({
  title,
  icon: Icon,
  medallion = "",
  children,
}: {
  title: string;
  icon: LucideIcon;
  medallion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div className="flex items-center gap-2.5">
          <span className={`medallion ${medallion} !h-7 !w-7 !rounded-[9px]`}>
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
      </div>
      <div className="space-y-2 p-5 text-sm text-ink-2">{children}</div>
    </section>
  );
}

const TROY_WEEKS = [
  ["1", "How Much Does Artificial Turf Cost in Texas?", "SEO pillar 1"],
  ["2", "Best Artificial Turf for Dogs", "SEO pillar 2"],
  ["3", "Does Turf Melt in Texas Heat? (105°F test)", "SEO pillar 3"],
  ["4", "Pickleball Court Cost breakdown", "July spotlight"],
  ["5", "Xeriscape 101 for Central Texas", "Aug spotlight"],
  ["6", "Pavers vs Stamped Concrete", "Oct spotlight"],
  ["7", "What Site Prep Actually Means", "Trust builder"],
  ["8", "Lot Clearing: cost + what to expect", "Service intro"],
  ["9", "5 Mistakes People Make Buying Turf", "Evergreen"],
  ["10", "Putting Green Install start to finish", "Service intro"],
  ["11", "Fence Options: wood vs steel vs welded", "Sep spotlight"],
  ["12", "Designing a Full Backyard", "Design showcase"],
];

const SPOTLIGHTS = [
  ["Jul", "Pickleball & sport courts", "Beat the waitlist for fall leagues"],
  ["Aug", "Xeriscape", "Water restrictions — your lawn is dying anyway"],
  ["Sep", "Fencing + custom welding", "Security, gates, steel that lasts"],
  ["Oct", "Pavers & stone work", "Patio season; holiday-hosting runway"],
  ["Nov", "Concrete", "Driveways, patios, slabs before year-end"],
  ["Dec", "Tree removal & lot clearing", "Dormant season = right time"],
  ["Jan", "Excavation & site prep", "Builders planning spring starts"],
  ["Feb", "Landscape design", "Design now, build in spring"],
  ["Mar", "Full-yard transformations", "Design→build showcase stories"],
  ["Apr", "Putting greens", "Masters season"],
  ["May", "Turf for dogs", "Highest-converting niche"],
  ["Jun", "Turf vs Texas heat", "Myth-busting, 105°F tests"],
];

export default async function PlaybookPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cm = await getContent();

  return (
    <div className="max-w-4xl space-y-6">
      <header className="reveal">
        <p className="eyebrow mb-2">Marketing</p>
        <h1 className="page-title">{cm.get("mkt.playbook.title")}</h1>
        <p className="page-sub">{cm.get("mkt.playbook.sub")}</p>
      </header>

      {/* The thesis — hero callout */}
      <section className="hero-band reveal p-5 sm:p-6" style={{ animationDelay: "60ms" }}>
        <div className="flex items-start gap-3.5">
          <span className="medallion medallion-brand medallion-lg">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="eyebrow mb-1.5 text-brand-strong">{cm.get("mkt.playbook.thesis.eyebrow")}</p>
            <RichText text={cm.get("mkt.playbook.thesis.body")} className="text-sm leading-relaxed text-ink-2" />
          </div>
        </div>
      </section>

      <Link
        href="/marketing/funnel"
        className="card card-hover group reveal flex items-center gap-4 p-4"
        style={{ animationDelay: "90ms" }}
      >
        <span className="medallion medallion-brand medallion-lg">
          <Target className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            Paid growth funnel <span className="chip chip-brand">New</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-3">
            The Meta ads framework — three layers, the audience ladder, ad scripts per turf
            type, budget, and metrics.
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-ink-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
      </Link>

      <div className="reveal space-y-5" style={{ animationDelay: "120ms" }}>
        <Section title={cm.get("mkt.playbook.referral.title")} icon={Gift} medallion="medallion-brand">
          <RichList text={cm.get("mkt.playbook.referral.bullets")} />
          <p className="text-xs text-ink-3">
            Run it from <Link href="/marketing/referrals" className="link-arrow">Referrals</Link>: Build roster → Export Reevo CSV → dial → log outcomes → track to reward.
          </p>
        </Section>

        <Section title={cm.get("mkt.playbook.cadence.title")} icon={Film} medallion="medallion-info">
          <RichText text={cm.get("mkt.playbook.cadence.body")} className="[&:not(:first-child)]:mt-2" />
          <p className="text-xs text-ink-3">
            The <Link href="/marketing/content" className="link-arrow">Content scoreboard</Link> tracks published-this-week counts live — that&rsquo;s the accountability number.
            (When Troy &amp; Max get app logins, these become auto-recurring tasks.)
          </p>
        </Section>

        <Section title={cm.get("mkt.playbook.troy.title")} icon={CalendarDays} medallion="medallion-warn">
          <div className="overflow-x-auto">
            <table className="w-full text-xs num">
              <thead>
                <tr className="text-left">
                  <th className="eyebrow py-1.5 pr-3">Wk</th>
                  <th className="eyebrow py-1.5 pr-3">Video</th>
                  <th className="eyebrow py-1.5">Tie-in</th>
                </tr>
              </thead>
              <tbody>
                {TROY_WEEKS.map(([wk, title, tie]) => (
                  <tr key={wk} className="border-t border-line">
                    <td className="py-2 pr-3 text-ink-4">{wk}</td>
                    <td className="py-2 pr-3 font-medium text-ink">{title}</td>
                    <td className="py-2 text-ink-3">{tie}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-3">All 12 are seeded as ideas in the <Link href="/marketing/content" className="link-arrow">Content pipeline</Link>.</p>
        </Section>

        <Section title={cm.get("mkt.playbook.spotlight.title")} icon={CalendarRange} medallion="medallion-info">
          <RichText text={cm.get("mkt.playbook.spotlight.intro")} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left">
                  <th className="eyebrow py-1.5 pr-3">Month</th>
                  <th className="eyebrow py-1.5 pr-3">Spotlight</th>
                  <th className="eyebrow py-1.5">Angle</th>
                </tr>
              </thead>
              <tbody>
                {SPOTLIGHTS.map(([m, s, a]) => (
                  <tr key={m} className="border-t border-line">
                    <td className="py-2 pr-3 font-semibold text-ink-2">{m}</td>
                    <td className="py-2 pr-3 font-medium text-ink">{s}</td>
                    <td className="py-2 text-ink-3">{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-3">Jul–Sep are seeded in <Link href="/marketing/campaigns" className="link-arrow">Campaigns</Link> as drafts.</p>
        </Section>

        <Section title={cm.get("mkt.playbook.wherethings.title")} icon={FolderTree}>
          <RichList text={cm.get("mkt.playbook.wherethings.bullets")} />
        </Section>
      </div>
    </div>
  );
}
