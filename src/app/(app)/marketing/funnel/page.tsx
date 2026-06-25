import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Eye, Flame, Target, Sparkles, ArrowDown, ArrowRight, Dog, Baby, Dumbbell,
  Flag, Layers, Users, MessageSquare, DollarSign, Gauge, ShieldAlert,
  ClipboardList, Megaphone, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Growth Funnel · Marketing · TexasTurf OS" };

/* ── Local building blocks ─────────────────────────────────────────────────── */

/** A value only Stefan knows — rendered as a visible "needs input" marker so the
 * team can see at a glance what still has to be filled in before going live. */
function Fill({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center rounded-md border border-warn/30 bg-warn-tint px-1.5 py-px text-[0.85em] font-semibold text-warn">
      {children}
    </span>
  );
}

function Section({
  n, title, icon: Icon, medallion = "", children,
}: {
  n: string; title: string; icon: LucideIcon; medallion?: string; children: React.ReactNode;
}) {
  return (
    <section className="panel reveal">
      <div className="panel-head">
        <div className="flex items-center gap-2.5">
          <span className={`medallion ${medallion} !h-7 !w-7 !rounded-[9px]`}>
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-ink">
            <span className="text-ink-4">{n}</span>&nbsp;&nbsp;{title}
          </h2>
        </div>
      </div>
      <div className="space-y-3 p-5 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

const SCRIPTS: Array<{
  icon: LucideIcon; medallion: string; name: string; lead: string;
  beats: Array<[string, React.ReactNode]>;
}> = [
  {
    icon: Dog, medallion: "medallion-brand", name: "Pet turf", lead: "Dog owners — muddy, smelly backyard",
    beats: [
      ["Call-out", <>“{`Texas`} dog owners — if your backyard is a muddy, smelly mess, listen up.”</>],
      ["Offer", <>This month, get <Fill>$ off</Fill> our pet-grade turf — built to drain, never hold odor, never brown from pet spots.</>],
      ["Price anchor", <>Most homeowners spend thousands reseeding dead grass every year — this is a one-time fix.</>],
      ["Service + benefit", <>A fully-drained, antimicrobial pet turf system — no mud in the house, no pee smell, no brown patches, a clean place for the dog year-round.</>],
      ["Scarcity", <>Booking the next <Fill>10</Fill> free consults this week only — ends Sunday.</>],
      ["Why us", <><Fill>X installs</Fill>, <Fill>Y 5-star reviews</Fill>. Tap below for your free <Fill>$ value</Fill> 3D yard visualization.</>],
    ],
  },
  {
    icon: Baby, medallion: "medallion-info", name: "Playground turf", lead: "Parents — safe year-round play",
    beats: [
      ["Call-out", <>“Parents — want a backyard your kids can play in safely, every day of the year?”</>],
      ["Offer", <>Right now, a free padded safety layer (a <Fill>$ value</Fill>) with any playground turf install.</>],
      ["Price anchor", <>Cheaper than a season of grass repair, mud, and ruined shoes.</>],
      ["Service + benefit", <>Soft, cushioned, pesticide-free turf — kids fall without getting hurt, play without tracking mud inside, no chemicals or allergens.</>],
      ["Scarcity", <>Limited to the next <Fill>15</Fill> families who book this week — ends Sunday.</>],
      ["Why us", <><Fill>X installs</Fill>, perfect 5-star reputation. Tap below for your free 3D visualization.</>],
    ],
  },
  {
    icon: Dumbbell, medallion: "medallion-warn", name: "Sports turf", lead: "Young athletes — train at home",
    beats: [
      ["Call-out", <>“Got a young athlete at home? This one’s for you.”</>],
      ["Offer", <>Save <Fill>$</Fill> this month on a pro-grade backyard sports turf install.</>],
      ["Price anchor", <>A fraction of what you’d pay in field rentals and travel over a few seasons.</>],
      ["Service + benefit", <>A durable, consistent, divot-free surface — train at home any time, on the same quality turf the pros practice on, rain or shine.</>],
      ["Scarcity", <>Only <Fill>10</Fill> spots this month — book by Sunday.</>],
      ["Why us", <><Fill>X installs</Fill> across Texas, all 5-star. Tap below for your free 3D visualization.</>],
    ],
  },
  {
    icon: Flag, medallion: "medallion-brand", name: "Putting green", lead: "Golfers — practice your short game",
    beats: [
      ["Call-out", <>“Texas golfers — what if you could practice your short game in your own backyard?”</>],
      ["Offer", <>This month only: <Fill>$ off</Fill> a custom backyard putting green.</>],
      ["Price anchor", <>Less than a year of range fees and green fees.</>],
      ["Service + benefit", <>A custom-contoured green with real break and roll — lower your handicap from home, entertain friends, add property value.</>],
      ["Scarcity", <>Booking the next <Fill>5</Fill> installs this week — ends Sunday.</>],
      ["Why us", <><Fill>X installs</Fill>, perfect 5-star reputation. Tap below for your free 3D green design.</>],
    ],
  },
];

export default async function FunnelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <FunnelFramework />;
}

/** Presentational body — pure static content, no auth/data. Rendered by the
 * authed page above and reused by the design preview. */
export function FunnelFramework() {
  const layers: Array<{ icon: LucideIcon; medallion: string; tag: string; title: string; body: string; budget: string }> = [
    { icon: Eye, medallion: "medallion-info", tag: "Layer 1 · Awareness", title: "Educate cheaply, build a warm pool", body: "Educational video at ~$3 per 1,000 people. Optimized for views, never leads — that's what keeps it cheap. Quietly fills an audience of everyone who watched.", budget: "~$50/day" },
    { icon: Flame, medallion: "medallion-warn", tag: "Layer 2 · Warm retargeting", title: "Go back to the watchers with the offer", body: "Small budget, strong free-offer lead magnet aimed only at people who already paid attention. These convert cheapest because they know you.", budget: "~$15–20/day" },
    { icon: Target, medallion: "medallion-brand", tag: "Layer 3 · Cold leads", title: "Hard-sell, one ad per turf type", body: "Your main spend. Direct-response 30–60s scripts with the full offer, segmented by product so the right person sees the right ad.", budget: "~$50–100/day" },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <header className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Marketing framework · Paid growth</p>
          <h1 className="page-title">Year-Round Green Funnel</h1>
          <p className="page-sub">
            A three-layer Meta funnel: educate Texas homeowners on why turf beats real
            grass, retarget the ones who pay attention with a free-visualization offer,
            and run hard-offer cold ads segmented by turf type.
          </p>
        </div>
        <Link href="/marketing/playbook" className="btn btn-line">
          <ArrowRight className="h-4 w-4 rotate-180" /> Organic playbook
        </Link>
      </header>

      {/* The machine */}
      <section className="hero-band reveal p-5 sm:p-7" style={{ animationDelay: "60ms" }}>
        <p className="eyebrow mb-1.5 text-brand-strong">The machine, in one read</p>
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-ink-2">
          You don’t pick a layer — you run all three at once and they feed each other.
          Then your pixel learns who actually fills out forms, and Meta hunts down more
          people exactly like them. That’s the whole engine.
        </p>
        <div className="space-y-2.5">
          {layers.map((l, i) => {
            const Icon = l.icon;
            return (
              <div key={l.tag}>
                <div className="flex items-center gap-3.5 rounded-xl border border-line bg-surface/80 p-3.5 shadow-e1 backdrop-blur-sm">
                  <span className={`medallion ${l.medallion}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{l.title}</p>
                      <span className="chip chip-neutral">{l.budget}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-ink-3">
                      <span className="font-semibold text-ink-2">{l.tag}.</span> {l.body}
                    </p>
                  </div>
                </div>
                {i < layers.length - 1 && (
                  <div className="flex justify-center py-0.5 text-ink-4">
                    <ArrowDown className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex justify-center py-0.5 text-ink-4"><ArrowDown className="h-4 w-4" /></div>
          <div className="flex items-center gap-3.5 rounded-xl border border-brand-line bg-brand-tint/60 p-3.5">
            <span className="medallion medallion-brand"><Sparkles className="h-[18px] w-[18px]" /></span>
            <div>
              <p className="text-sm font-semibold text-brand-strong">The lookalike engine (turns on later)</p>
              <p className="mt-0.5 text-xs leading-snug text-ink-2">
                After ~30–50 real form-fills, Meta auto-hunts a 1% lookalike of your actual
                converters. The more leads the pixel sees, the cheaper the next one gets.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 1 · Goals */}
      <Section n="01" title="Campaign overview" icon={Megaphone} medallion="medallion-brand">
        <p>
          <span className="font-semibold text-ink">System name:</span> Texas Turf — Year-Round Green Funnel.
        </p>
        <p>
          <span className="font-semibold text-ink">Primary goal:</span> generate{" "}
          <Fill>~60</Fill> qualified leads/month under your break-even cost per lead
          (§08), then scale spend as the pixel gets smarter.
        </p>
        <p>
          <span className="font-semibold text-ink">Secondary:</span> build a warm audience
          of 25,000+ video-watchers in your service area within 60 days, and reach
          “oh, I’ve seen these guys” recognition before a homeowner ever talks to a competitor.
        </p>
      </Section>

      {/* 2 · Account structure */}
      <Section n="02" title="Account structure — what your media buyer builds" icon={Layers} medallion="medallion-info">
        <p>
          Three campaigns by funnel stage, products isolated at the ad-set level. Name every
          ad set <span className="chip chip-outline">Age · Radius · TurfType · Temp</span> — e.g.
          “30-60 · <Fill>25mi</Fill> · Pet Turf · Cold” — so the account stays readable.
        </p>
        <div className="space-y-2.5">
          {[
            { n: "1", name: "Awareness", obj: "Video Views", budget: "~$50/day", sets: "Pet · Playground · Sports · Putting (broad)", note: "Each holds 2–4 awareness videos. NOT optimized for leads." },
            { n: "2", name: "Warm retargeting", obj: "Leads", budget: "~$15–20/day", sets: "Video viewers 50%+ · Site visitors (no form yet)", note: "Holds the strong free-offer ads." },
            { n: "3", name: "Cold leads", obj: "Leads", budget: "~$50–100/day", sets: "Pet · Playground · Sports · Putting (cold)", note: "Main spend. Holds the §06 core-offer scripts.", main: true },
            { n: "4", name: "Cold — Max Conversions", obj: "Leads", budget: "after ~30–50 fills", sets: "1% Lookalike of form-fillers", note: "Turn on AFTER the pixel has real conversions to learn from." },
          ].map((c) => (
            <div key={c.n} className={"flex items-start gap-3 rounded-xl border p-3.5 " + (c.main ? "border-brand-line bg-brand-tint/40" : "border-line bg-sunken/40")}>
              <span className={`medallion ${c.main ? "medallion-brand" : ""} !h-7 !w-7 !rounded-[9px]`}>
                <span className="text-xs font-bold">{c.n}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">Campaign {c.n} — {c.name}</p>
                  <span className="chip chip-outline">{c.obj}</span>
                  <span className={"chip " + (c.main ? "chip-brand" : "chip-neutral")}>{c.budget}</span>
                </div>
                <p className="mt-1 text-xs text-ink-2"><span className="font-medium text-ink">Ad sets:</span> {c.sets}</p>
                <p className="mt-0.5 text-xs text-ink-3">{c.note}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 3 · Audience ladder */}
      <Section n="03" title="Audience & the retargeting ladder" icon={Users} medallion="medallion-warn">
        <p>Base cold bubble: age 30–60, <Fill>radius from HQ</Fill>, homeowners. Then tailor per product and build these custom audiences on day 1:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left">
                <th className="eyebrow py-1.5 pr-3">#</th>
                <th className="eyebrow py-1.5 pr-3">Audience</th>
                <th className="eyebrow py-1.5 pr-3">Defined by</th>
                <th className="eyebrow py-1.5">Used in</th>
              </tr>
            </thead>
            <tbody className="text-ink-2">
              {[
                ["1", "Cold", "Interests + demographics", "Cold Leads"],
                ["2", "Warm — engaged", "Video viewers 3s / 25 / 50 / 75%", "Warm Retargeting"],
                ["3", "Warm — page visitors", "Pixel: hit the landing page", "Warm Retargeting"],
                ["4", "Warmest", "Visited page, no form submit", "Warm Retargeting"],
                ["5", "Converters", "Submitted the lead form", "Source for Lookalikes"],
                ["6", "Lookalike 1% & 3%", "Meta builds “people like converters”", "Cold Max-Conversions"],
              ].map(([n, a, d, u]) => (
                <tr key={n} className="border-t border-line">
                  <td className="py-2 pr-3 text-ink-4">{n}</td>
                  <td className="py-2 pr-3 font-medium text-ink">{a}</td>
                  <td className="py-2 pr-3">{d}</td>
                  <td className="py-2 text-ink-3">{u}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-3">The 5→6 jump is the whole insight: more real form-fills → Meta finds the next lead on autopilot. The pixel + landing page matter more than anything.</p>
      </Section>

      {/* 4 · Messages */}
      <Section n="04" title="Key messages — the Texas angle" icon={MessageSquare} medallion="medallion-info">
        <p className="font-medium text-ink">Texas grass dies every summer. Texas Turf stays perfect year-round — no water bills, no mowing, no mud — and it pays for itself.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left"><th className="eyebrow py-1.5 pr-3">Message</th><th className="eyebrow py-1.5">Proof to show</th></tr></thead>
            <tbody className="text-ink-2">
              {[
                ["“Stop paying to water grass that dies anyway”", "Water-restriction headlines + before/after dead → green"],
                ["“Zero maintenance — no mowing, reseeding, chemicals”", "Install time-lapse; one-hose rinse"],
                ["“Safe for kids and pets”", "Playground pad, dog playing, “no pesticides” callout"],
                ["“It pays for itself”", <><Fill>avg monthly lawn cost</Fill> × years vs. one-time install</>],
                ["“Why us”", <><Fill>X installs</Fill>, <Fill>Y 5-star reviews</Fill>, <Fill>Z years</Fill></>],
              ].map(([m, p], i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="py-2 pr-3 font-medium text-ink">{m}</td>
                  <td className="py-2 text-ink-3">{p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rounded-lg border border-warn/25 bg-warn-tint px-3 py-2 text-xs text-warn">
          Don’t invent credibility numbers. Use your real install count and review total — give them to me and I’ll lock them into every script.
        </p>
      </Section>

      {/* 5 · Awareness creative */}
      <Section n="05" title="Awareness layer — content to film" icon={Eye} medallion="medallion-info">
        <p>Objective: <span className="font-semibold text-ink">Video Views</span> (never Leads — that would 10× your CPM). ~$50/day. These run for months. Four to film:</p>
        <ol className="ml-1 space-y-2">
          {[
            ["Testimonial reel", "3–4 real customers cut together — “best decision… no more mud.” End card: free quote."],
            ["“Why turf beats grass”", "You on camera, 30–45s: water bills, summer heat, mowing vs. perfect green year-round."],
            ["Process / before-after", "Silent: dead patchy lawn → grade → install → reveal. Satisfying, shareable."],
            ["Problem → solution", "“100°+ heat, drought restrictions, constant watering — here's what turf does about it.”"],
          ].map(([t, d], i) => (
            <li key={i} className="flex gap-3">
              <span className="medallion !h-6 !w-6 !rounded-lg text-[0.7rem] font-bold">{i + 1}</span>
              <span><span className="font-semibold text-ink">{t}</span> — <span className="text-ink-3">{d}</span></span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-ink-3">Measure by reach and cost-per-view, not leads. This layer’s real job is filling your warm video-viewer audience.</p>
      </Section>

      {/* 6 · Cold scripts */}
      <Section n="06" title="Cold lead scripts — your filming homework" icon={Target} medallion="medallion-brand">
        <p>30–60s, shot vertically on a phone. Framework: <span className="font-medium text-ink">Call-out → Offer → Price anchor → Service + Benefit → Scarcity → Why us.</span> Free 3D yard visualization is the lead magnet — high value, low cost, lets them see the yard before they buy.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SCRIPTS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.name} className="card flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2.5">
                  <span className={`medallion ${s.medallion}`}><Icon className="h-[18px] w-[18px]" /></span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{s.name}</p>
                    <p className="text-xs text-ink-3">{s.lead}</p>
                  </div>
                </div>
                <dl className="space-y-2">
                  {s.beats.map(([label, text]) => (
                    <div key={label}>
                      <dt className="eyebrow mb-0.5">{label}</dt>
                      <dd className="text-xs leading-relaxed text-ink-2">{text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 7 · Warm closer */}
      <Section n="07" title="Warm retargeting — the closer" icon={Flame} medallion="medallion-warn">
        <p>Objective: Leads. ~$15–20/day (small audience). Discount the price first, then stack a free bonus for form-fillers:</p>
        <blockquote className="rounded-xl border-l-2 border-brand bg-sunken/50 px-4 py-3 text-sm italic text-ink-2">
          “This turf special is going viral — and here’s why. Get <Fill>$X off</Fill> our{" "}
          <Fill>product</Fill> install — normally <Fill>$anchor</Fill>, this week just{" "}
          <Fill>$deal</Fill>. Plus, the next <Fill>15</Fill> people who fill out the form get
          a free 3D yard visualization worth <Fill>$value</Fill> — see your exact yard
          transformed before you commit. Offer ends Sunday. Tap Get Offer below.”
        </blockquote>
        <p className="text-xs text-ink-3">Sends to a landing page with the form + pixel firing — that turns warm watchers into pixel data that powers the lookalike engine.</p>
      </Section>

      {/* 8 · Budget */}
      <Section n="08" title="Budget — lean start vs. scale" icon={DollarSign} medallion="medallion-brand">
        <div className="overflow-x-auto">
          <table className="w-full text-xs num">
            <thead><tr className="text-left"><th className="eyebrow py-1.5 pr-3">Layer</th><th className="eyebrow py-1.5 pr-3">Lean</th><th className="eyebrow py-1.5 pr-3">Scaling</th><th className="eyebrow py-1.5">Notes</th></tr></thead>
            <tbody className="text-ink-2">
              {[
                ["Awareness", "$50/day", "$50–75/day", "Cheapest CPMs; build the warm pool"],
                ["Warm retargeting", "$15/day", "$25/day", "Small audience — don't overspend"],
                ["Cold leads", "$50/day", "$100–300/day", "Your growth lever"],
              ].map(([l, a, b, n]) => (
                <tr key={l} className="border-t border-line"><td className="py-2 pr-3 font-medium text-ink">{l}</td><td className="py-2 pr-3">{a}</td><td className="py-2 pr-3">{b}</td><td className="py-2 text-ink-3">{n}</td></tr>
              ))}
              <tr className="border-t border-line-strong font-semibold text-ink"><td className="py-2 pr-3">Total</td><td className="py-2 pr-3">~$3,450/mo</td><td className="py-2 pr-3">scale w/ proven CPL</td><td className="py-2 text-ink-3 font-normal">+10–15% for creative</td></tr>
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-brand-line bg-brand-tint/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-strong">Break-even cost per lead</p>
          <p className="mt-1 text-sm text-ink"><span className="font-semibold">Allowable CPL = profit per install × close rate.</span></p>
          <p className="mt-1 text-xs text-ink-2">
            e.g. <Fill>$3,000</Fill> profit × 1-in-10 close ≈ <span className="font-semibold text-ink">$300/lead</span> break-even —
            anything under that is profit. Turf is high-ticket; don’t judge CPL against a $9.95 offer.
          </p>
        </div>
      </Section>

      {/* 9 · Metrics */}
      <Section n="09" title="Success metrics & the frequency rule" icon={Gauge} medallion="medallion-info">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left"><th className="eyebrow py-1.5 pr-3">Layer</th><th className="eyebrow py-1.5 pr-3">Watch</th><th className="eyebrow py-1.5">Target</th></tr></thead>
            <tbody className="text-ink-2">
              {[
                ["Awareness", "CPM", "under ~$4 / 1,000"],
                ["Awareness", "Warm audience size", "25k+ in 60 days"],
                ["All", "Frequency", "under 2.5 — rotate creative before fatigue"],
                ["Warm", "Cost per lead", "lowest of the three"],
                ["Cold", "Cost per lead", "under break-even (§08)"],
                ["Whole funnel", "Leads → consults → quotes → jobs", "track end-to-end in the CRM"],
              ].map(([l, w, t], i) => (
                <tr key={i} className="border-t border-line"><td className="py-2 pr-3 font-medium text-ink">{l}</td><td className="py-2 pr-3">{w}</td><td className="py-2 text-ink-3">{t}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 10 · Risks */}
      <Section n="10" title="Risks & how we avoid them" icon={ShieldAlert} medallion="medallion-danger">
        <ul className="space-y-2">
          {[
            ["Buyer optimizes Awareness for leads", "Awareness = Video Views ONLY. Cheap CPMs depend on it."],
            ["Pixel not firing on the landing page", "Breaks the lookalike engine entirely. Verify Lead event before spending on cold."],
            ["Weak offer", "The free 3D visualization is the unfair advantage — lean on it."],
            ["Ad fatigue", "Frequency cap < 2.5, rotate creative."],
            ["Judging CPL too early", "Use the break-even math — turf is high-ticket."],
          ].map(([r, f], i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-1.5 dot dot-danger" />
              <span><span className="font-semibold text-ink">{r}</span> — <span className="text-ink-3">{f}</span></span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Needs from you */}
      <section className="panel reveal">
        <div className="panel-head">
          <div className="flex items-center gap-2.5">
            <span className="medallion medallion-warn !h-7 !w-7 !rounded-[9px]"><ClipboardList className="h-4 w-4" /></span>
            <h2 className="text-sm font-semibold text-ink">To go live — fill these in</h2>
          </div>
        </div>
        <ul className="divide-y divide-line">
          {[
            ["Service radius + HQ city", "for geo targeting"],
            ["Real credibility stats", "# installs, # 5-star reviews, years in business"],
            ["Actual offer per product", "the $ discount and/or freebie — and can you deliver the free 3D visualization?"],
            ["Avg profit per install + close rate", "to lock your allowable CPL"],
            ["Starting monthly budget", "what you're comfortable beginning at"],
          ].map(([t, d], i) => (
            <li key={i} className="flex items-start gap-3 px-5 py-3">
              <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border border-line-strong text-[0.7rem] font-bold text-ink-3">{i + 1}</span>
              <span className="text-sm"><span className="font-semibold text-ink">{t}</span> <span className="text-ink-3">— {d}</span></span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
