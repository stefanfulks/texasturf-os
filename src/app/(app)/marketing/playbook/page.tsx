import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Gift, Film, CalendarDays, CalendarRange, FolderTree, Sparkles, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="max-w-4xl space-y-6">
      <header className="reveal">
        <p className="eyebrow mb-2">Marketing</p>
        <h1 className="page-title">Marketing Playbook</h1>
        <p className="page-sub">
          The plan everyone follows. Calls run in Reevo, sends go out via Jobber, the
          record lives here.
        </p>
      </header>

      {/* The thesis — hero callout */}
      <section className="hero-band reveal p-5 sm:p-6" style={{ animationDelay: "60ms" }}>
        <div className="flex items-start gap-3.5">
          <span className="medallion medallion-brand medallion-lg">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="eyebrow mb-1.5 text-brand-strong">The system in one line</p>
            <p className="text-sm leading-relaxed text-ink-2">
              We grow through <strong className="text-ink">past clients (referrals)</strong>,{" "}
              <strong className="text-ink">all 13 service lines</strong> (not just turf), and{" "}
              <strong className="text-ink">content</strong> (Troy&rsquo;s videos + field POV).
              TexasTurf isn&rsquo;t a turf company — it&rsquo;s an outdoor construction company.
              One crew relationship, thirteen capabilities.
            </p>
          </div>
        </div>
      </section>

      <div className="reveal space-y-5" style={{ animationDelay: "120ms" }}>
        <Section title="Referral program — the Thank-You Blitz" icon={Gift} medallion="medallion-brand">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="text-ink">Reward (referrer&rsquo;s choice):</strong> $250 Visa gift card or 1 year of the TexasTurf Care Plan free.</li>
            <li><strong className="text-ink">Referred friend:</strong> $100 off their project.</li>
            <li><strong className="text-ink">Earned when:</strong> the referred job is completed and the final invoice is paid.</li>
            <li><strong className="text-ink">Uncapped, never expires.</strong> B2B partners (pool builders, designers) get reciprocal terms, not gift cards.</li>
            <li><strong className="text-ink">Care Plan</strong> = annual deep-clean + groom, seam/edge inspection w/ minor repairs, drainage check, pet-odor treatment, priority scheduling, 10% off other work. Never call it &ldquo;insurance.&rdquo;</li>
          </ul>
          <p className="text-xs text-ink-3">
            Run it from <Link href="/marketing/referrals" className="link-arrow">Referrals</Link>: Build roster → Export Reevo CSV → dial → log outcomes → track to reward.
          </p>
        </Section>

        <Section title="Content cadence — the accountability loop" icon={Film} medallion="medallion-info">
          <p className="font-medium text-ink">Troy — 1 long YouTube video / week (publishes Friday)</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="text-ink">Mon</strong> — pick topic + outline/script</li>
            <li><strong className="text-ink">Wed</strong> — film (piggyback on an active job site)</li>
            <li><strong className="text-ink">Thu</strong> — hand to editor</li>
            <li><strong className="text-ink">Fri</strong> — publish + log it in <Link href="/marketing/content" className="link-arrow">Content</Link></li>
          </ul>
          <p className="mt-2 font-medium text-ink">Max — 2–3 POV clips / week (Meta glasses)</p>
          <p>Excavator cab, loading trucks, seam work, timelapses. The raw views engine. Drop into the Content library.</p>
          <p className="mt-2 font-medium text-ink">Every crew — per job</p>
          <p>1 before walkthrough, 1 process clip, 1 after reveal. Foreman checklist item; lands in the library.</p>
          <p className="text-xs text-ink-3">
            The <Link href="/marketing/content" className="link-arrow">Content scoreboard</Link> tracks published-this-week counts live — that&rsquo;s the accountability number.
            (When Troy &amp; Max get app logins, these become auto-recurring tasks.)
          </p>
        </Section>

        <Section title="Troy — 12-week starter calendar" icon={CalendarDays} medallion="medallion-warn">
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

        <Section title="12-month service spotlight calendar" icon={CalendarRange} medallion="medallion-info">
          <p>One service line per month. Each ships the same kit: Jobber email + Troy long video + 4–6 shorts + before/after set + SEO post + yard-sign/social CTA swap.</p>
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

        <Section title="Where things live" icon={FolderTree}>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="text-ink">Reevo</strong> — outbound calls + sequences (the referral dialer).</li>
            <li><strong className="text-ink">Jobber</strong> — client-facing emails + passive referral links.</li>
            <li><strong className="text-ink">This app</strong> — the record: roster, ledger, campaign briefs/copy, content pipeline + library.</li>
            <li><strong className="text-ink">Google Drive</strong> — master video/photo files. <strong className="text-ink">YouTube</strong> — publishing. <strong className="text-ink">This app</strong> holds the links + small voice memos.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
