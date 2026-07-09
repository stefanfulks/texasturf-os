import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Gift,
  Megaphone,
  Phone,
  Sparkles,
  Star,
  Sun,
  Users,
  Film,
  BookOpen,
  CheckCircle2,
  Target,
  type LucideIcon,
} from "lucide-react";

/**
 * Marketing overview — the showcase surface for the module. Presentational by
 * design: it takes already-fetched counts + campaigns as props so the same
 * markup renders for the authed page (real Supabase data) and the design
 * preview (mock data). No data fetching, no client state.
 */

export type OverviewCampaign = {
  id: string;
  slug: string | null;
  name: string;
  type: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  service_line: string | null;
};

export type MarketingOverviewProps = {
  campaigns: OverviewCampaign[];
  counts: {
    activeCampaigns: number;
    calls: number;
    rewardsDue: number;
    reviews: number;
    /** Ads business inputs still blank (amber until filled). */
    inputsMissing: number;
    inputsTotal: number;
    /** Active campaigns with no next_action set. */
    campaignsNoAction: number;
    publishedThisWeek: number;
    ideasBank: number;
    aiDraftsThisWeek: number;
  };
};

const TYPE_META: Record<string, { label: string; icon: LucideIcon; medallion: string }> = {
  referral:          { label: "Referral",          icon: Gift,       medallion: "medallion-brand" },
  service_spotlight: { label: "Service spotlight",  icon: Sparkles,   medallion: "medallion-info" },
  seasonal:          { label: "Seasonal",           icon: Sun,        medallion: "medallion-warn" },
  event:             { label: "Event",              icon: CalendarDays, medallion: "medallion-info" },
  other:             { label: "Campaign",           icon: Megaphone,  medallion: "" },
};

/** Shared by the overview and the campaigns list so the visual language stays
 * identical across the module. */
export function typeMeta(type: string) {
  return TYPE_META[type] ?? TYPE_META.other;
}

export function StatusChip({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <span className="chip chip-brand">
          <span className="dot dot-brand dot-pulse" />
          Active
        </span>
      );
    case "paused":
      return <span className="chip chip-warn">Paused</span>;
    case "completed":
      return <span className="chip chip-outline">Completed</span>;
    default:
      return <span className="chip chip-neutral">Draft</span>;
  }
}

/** Fmt a YYYY-MM-DD into "Jun 25" without pulling a date lib through here. */
export function shortDate(d: string | null): string | null {
  if (!d) return null;
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MarketingOverview({ campaigns, counts }: MarketingOverviewProps) {
  const {
    activeCampaigns, calls, rewardsDue, reviews,
    inputsMissing, inputsTotal, campaignsNoAction,
    publishedThisWeek, ideasBank, aiDraftsThisWeek,
  } = counts;

  // Surface the single most important action as the hero. Ordered by urgency:
  // money owed → outreach queued → missing ad numbers → reviews → directionless
  // campaigns → the calm all-clear state.
  const focus =
    rewardsDue > 0
      ? {
          eyebrow: "Action needed",
          title: `${rewardsDue} referral reward${rewardsDue > 1 ? "s" : ""} ready to pay out`,
          body: "Close the loop while it still feels earned — fast payouts are what keep referrals coming.",
          cta: "Review rewards",
          href: "/marketing/referrals",
          icon: Gift,
        }
      : calls > 0
        ? {
            eyebrow: "Referral Thank-You Blitz",
            title: `${calls} call${calls > 1 ? "s" : ""} left in this week's outreach`,
            body: "Every referral that closes pays out $200 — and the asking is half-done for you. Knock these out.",
            cta: "Start calling",
            href: "/marketing/referrals",
            icon: Phone,
          }
        : inputsMissing > 0
          ? {
              eyebrow: "Ads setup",
              title: `${inputsTotal - inputsMissing} of ${inputsTotal} ad numbers filled in`,
              body: "The break-even math and the AI ad writer run on your real numbers — the blanks come out as [placeholders] until you fill them.",
              cta: "Fill in your numbers",
              href: "/marketing/funnel",
              icon: Target,
            }
          : reviews > 0
            ? {
                eyebrow: "Reputation",
                title: `${reviews} happy customer${reviews > 1 ? "s" : ""} ready to be asked for a review`,
                body: "Reviews are the cheapest marketing you have. Ask while the install is still fresh in their mind.",
                cta: "Send review asks",
                href: "/marketing/reviews",
                icon: Star,
              }
            : campaignsNoAction > 0
              ? {
                  eyebrow: "Campaigns",
                  title: `${campaignsNoAction} active campaign${campaignsNoAction > 1 ? "s" : ""} with no next action`,
                  body: "Every active campaign should name its next step. Open each one and set the single action for this week.",
                  cta: "Review campaigns",
                  href: "/marketing/campaigns",
                  icon: Megaphone,
                }
              : {
                  eyebrow: "All caught up",
                  title: "No outreach waiting — the pipeline is clean",
                  body: "Nothing needs you right now. Spin up a campaign or capture content while there's room to breathe.",
                  cta: "New campaign",
                  href: "/marketing/campaigns",
                  icon: CheckCircle2,
                };

  const FocusIcon = focus.icon;

  const kpis: Array<{
    label: string;
    value: number;
    icon: LucideIcon;
    href: string;
    accent: string;
    foot: string;
    urgent?: boolean;
  }> = [
    { label: "Active campaigns", value: activeCampaigns, icon: Megaphone, href: "/marketing/campaigns", accent: "", foot: "running now" },
    { label: "Calls remaining", value: calls, icon: Phone, href: "/marketing/referrals", accent: calls > 0 ? "stat-accent-warn" : "", foot: "referral blitz", urgent: calls > 0 },
    { label: "Rewards due", value: rewardsDue, icon: Gift, href: "/marketing/referrals", accent: rewardsDue > 0 ? "stat-accent-danger" : "", foot: "to pay out", urgent: rewardsDue > 0 },
    { label: "Reviews to ask", value: reviews, icon: Star, href: "/marketing/reviews", accent: reviews > 0 ? "stat-accent-warn" : "", foot: "pending outreach", urgent: reviews > 0 },
    { label: "Published this wk", value: publishedThisWeek, icon: Film, href: "/marketing/content", accent: publishedThisWeek > 0 ? "stat-accent-brand" : "", foot: `${ideasBank} ideas banked` },
    { label: "AI drafts this wk", value: aiDraftsThisWeek, icon: Sparkles, href: "/marketing/content", accent: "", foot: "across all sections" },
  ];

  const modules: Array<{ label: string; body: string; href: string; icon: LucideIcon; medallion: string }> = [
    { label: "Ads", body: "The paid Meta funnel framework — layers, audiences, scripts, budget.", href: "/marketing/funnel", icon: Target, medallion: "medallion-brand" },
    { label: "Content", body: "Capture video, photos, and POVs; track the pipeline to published.", href: "/marketing/content", icon: Film, medallion: "medallion-info" },
    { label: "Organic Growth", body: "The organic plan: referrals, content cadence, service spotlights.", href: "/marketing/playbook", icon: BookOpen, medallion: "medallion-brand" },
    { label: "Referrals", body: "Roster, outreach calls, and the reward ledger end to end.", href: "/marketing/referrals", icon: Users, medallion: "medallion-warn" },
    { label: "Reviews", body: "Ask at the right moment and watch the reputation flywheel turn.", href: "/marketing/reviews", icon: Star, medallion: "" },
  ];

  return (
    <div className="space-y-7">
      {/* Page header */}
      <header className="reveal flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Marketing</p>
          <h1 className="page-title">Growth, referrals &amp; reputation</h1>
          <p className="page-sub">
            Campaigns, the referral program, the content engine, and reviews — one
            system of record. Sends go out via Jobber; calls run in Reevo.
          </p>
        </div>
        <Link href="/marketing/campaigns" className="btn btn-primary self-start sm:self-auto">
          <Megaphone className="h-4 w-4" />
          New campaign
        </Link>
      </header>

      {/* Focus hero — the one thing most worth doing right now */}
      <section className="hero-band reveal p-5 sm:p-7" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="medallion medallion-brand medallion-lg">
              <FocusIcon className="h-5 w-5" />
            </span>
            <div className="max-w-xl">
              <p className="eyebrow mb-1.5 text-brand-strong">{focus.eyebrow}</p>
              <h2 className="text-lg font-semibold leading-snug tracking-tight text-ink sm:text-xl">
                {focus.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{focus.body}</p>
            </div>
          </div>
          <Link href={focus.href} className="btn btn-primary flex-shrink-0 self-start sm:self-auto">
            {focus.cta}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* KPI band */}
      <section className="reveal grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" style={{ animationDelay: "120ms" }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href} className={`stat ${k.accent}`}>
              <div className="flex items-start justify-between">
                <span className="stat-label">{k.label}</span>
                <span className={`medallion ${k.urgent ? k.accent.replace("stat-accent", "medallion") : "medallion-brand"} !h-7 !w-7 !rounded-[9px]`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <span className={`stat-value ${k.urgent ? "" : ""}`}>{k.value}</span>
              <span className="stat-foot">{k.foot}</span>
            </Link>
          );
        })}
      </section>

      {/* Campaigns */}
      <section className="panel reveal" style={{ animationDelay: "180ms" }}>
        <div className="panel-head">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">Campaigns</span>
            <span className="chip chip-neutral">{campaigns.length}</span>
          </div>
          <Link href="/marketing/campaigns" className="link-arrow">
            Manage <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="empty-state">
            <span className="medallion medallion-brand">
              <Megaphone className="h-5 w-5" />
            </span>
            <p className="empty-state-title">No campaigns yet</p>
            <p className="empty-state-body">
              The referral Thank-You Blitz seeds on first migration. Launch a campaign
              to start tracking reach, referrals, and payouts here.
            </p>
            <Link href="/marketing/campaigns" className="btn btn-primary btn-sm mt-1">
              <Megaphone className="h-3.5 w-3.5" />
              New campaign
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {campaigns.map((c) => {
              const meta = typeMeta(c.type);
              const Icon = meta.icon;
              const start = shortDate(c.starts_on);
              return (
                <li key={c.id}>
                  <Link
                    href={c.type === "referral" ? "/marketing/referrals" : `/marketing/campaigns/${c.id}`}
                    className="row-link flex items-center gap-3.5 px-4 py-3.5 sm:px-5"
                  >
                    <span className={`medallion ${meta.medallion}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-3">
                        {meta.label}
                        {c.service_line ? ` · ${c.service_line}` : ""}
                        {start ? ` · starts ${start}` : ""}
                      </p>
                    </div>
                    <StatusChip status={c.status} />
                    <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-ink-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Module hub */}
      <section className="reveal space-y-3" style={{ animationDelay: "240ms" }}>
        <p className="eyebrow">Jump into</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.label} href={m.href} className="card card-hover group flex flex-col gap-3 p-4">
                <span className={`medallion ${m.medallion}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="flex items-center gap-1 text-sm font-semibold text-ink">
                    {m.label}
                    <ArrowUpRight className="h-3.5 w-3.5 text-ink-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-3">{m.body}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
