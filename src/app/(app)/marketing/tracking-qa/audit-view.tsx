import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  Target,
  Radio,
  Gauge,
  Layers,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { AuditSnapshot, EmqRow, Flag, Severity } from "./types";

/**
 * Presentational tracking-QA view. Takes an already-computed snapshot (+ prior
 * weeks) and renders it — no data fetching, no client state. Mirrors the
 * marketing-overview pattern so the same markup can drive a design preview.
 */

const SEVERITY: Record<
  Severity,
  { icon: LucideIcon; medallion: string; chip: string; label: string; order: number }
> = {
  critical: { icon: AlertOctagon, medallion: "medallion-danger", chip: "chip-danger", label: "Critical", order: 0 },
  warn: { icon: AlertTriangle, medallion: "medallion-warn", chip: "chip-warn", label: "Warning", order: 1 },
  ok: { icon: CheckCircle2, medallion: "medallion-brand", chip: "chip-brand", label: "Healthy", order: 2 },
  info: { icon: Info, medallion: "medallion-info", chip: "chip-outline", label: "Info", order: 3 },
};

/** Fixed match-key column order for the EMQ table. */
const MATCH_KEYS = ["email", "phone", "fbc", "fbp", "external_id"] as const;

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "chip-brand",
    WITH_ISSUES: "chip-danger",
    PAUSED: "chip-neutral",
  };
  return <span className={`chip ${map[status] ?? "chip-outline"}`}>{status.replace(/_/g, " ").toLowerCase()}</span>;
}

/* ── EMQ helpers ──────────────────────────────────────────────────────────── */

function compositeTone(v: number | null): { cls: string; label: string } {
  if (v === null) return { cls: "text-danger", label: "No EMQ" };
  if (v < 6) return { cls: "text-danger", label: v.toFixed(1) };
  if (v < 8) return { cls: "text-warn", label: v.toFixed(1) };
  return { cls: "text-brand", label: v.toFixed(1) };
}

function coverageOf(row: EmqRow, key: string): number | null {
  return row.matchKeys.find((k) => k.key === key)?.coverage ?? null;
}

/* ── Sections ─────────────────────────────────────────────────────────────── */

function FlagsPanel({ flags }: { flags: Flag[] }) {
  const sorted = [...flags].sort((a, b) => SEVERITY[a.severity].order - SEVERITY[b.severity].order);
  return (
    <div className="space-y-2.5">
      {sorted.map((f, i) => {
        const s = SEVERITY[f.severity];
        const Icon = s.icon;
        return (
          <div key={i} className="card flex items-start gap-3 p-4">
            <span className={`medallion ${s.medallion} !h-8 !w-8 !rounded-[10px] shrink-0`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
                <span className={`chip ${s.chip}`}>{s.label}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{f.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttributionGapPanel({ audit }: { audit: AuditSnapshot }) {
  const g = audit.attributionGap;
  const cells: Array<{ label: string; value: string; accent: string; foot: string }> = [
    {
      label: "Pixel Lead events",
      value: String(g.pixelLeads),
      accent: "stat-accent-info",
      foot: "Counted at the pixel",
    },
    {
      label: "Meta-attributed Leads",
      value: String(g.metaAttributedLeads),
      accent: "stat-accent-danger",
      foot: g.metaAttributedRaw,
    },
    {
      label: "Buyer's corrected",
      value: g.buyerCorrectedLeads === null ? "—" : String(g.buyerCorrectedLeads),
      accent: "stat-accent-brand",
      foot: g.buyerCorrectedLeads === null ? "Set on next weekly report" : "Manually counted",
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cells.map((c) => (
        <div key={c.label} className={`stat ${c.accent}`}>
          <div className="stat-label">{c.label}</div>
          <div className="stat-value num">{c.value}</div>
          <div className="stat-foot">{c.foot}</div>
        </div>
      ))}
    </div>
  );
}

function OptimizationPanel({ audit }: { audit: AuditSnapshot }) {
  const c = audit.campaign;
  const steps: Array<{ label: string; value: string; ok: boolean | null }> = [
    { label: "Optimizing for", value: c.optimizedEvent, ok: null },
    { label: "Event firing?", value: c.eventIsFiring ? "Yes" : "No", ok: c.eventIsFiring },
    { label: "Usable by Meta?", value: c.signalUsableByMeta ? "Yes" : "No", ok: c.signalUsableByMeta },
    { label: "Attributed", value: String(audit.attributionGap.metaAttributedLeads), ok: audit.attributionGap.metaAttributedLeads > 0 },
  ];
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      {steps.map((st, i) => (
        <div key={st.label} className="flex flex-1 items-center gap-2">
          <div
            className={`flex-1 rounded-xl border p-3 ${
              st.ok === false
                ? "border-danger/30 bg-danger-tint"
                : st.ok === true
                  ? "border-brand-line bg-brand-tint"
                  : "border-line bg-sunken"
            }`}
          >
            <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-3">{st.label}</div>
            <div
              className={`mt-0.5 text-sm font-semibold ${
                st.ok === false ? "text-danger" : st.ok === true ? "text-brand" : "text-ink"
              }`}
            >
              {st.value}
            </div>
          </div>
          {i < steps.length - 1 && <ArrowRight className="hidden h-4 w-4 shrink-0 text-ink-4 sm:block" />}
        </div>
      ))}
    </div>
  );
}

function EmqTable({ rows }: { rows: EmqRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[0.7rem] uppercase tracking-wide text-ink-3">
            <th className="py-2 pr-3 font-semibold">Event</th>
            <th className="py-2 px-3 font-semibold">Composite</th>
            {MATCH_KEYS.map((k) => (
              <th key={k} className="py-2 px-3 font-semibold">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tone = compositeTone(r.composite);
            return (
              <tr key={r.event} className="border-b border-line/60">
                <td className="py-2.5 pr-3">
                  <span className="font-medium text-ink">{r.event}</span>
                  {r.isConversion && <span className="ml-1.5 chip chip-outline">conversion</span>}
                </td>
                <td className={`py-2.5 px-3 font-semibold ${tone.cls}`}>{tone.label}</td>
                {MATCH_KEYS.map((k) => {
                  const cov = coverageOf(r, k);
                  const low = k === "fbc" && cov !== null && cov < 70;
                  return (
                    <td
                      key={k}
                      className={`py-2.5 px-3 num ${
                        cov === null ? "text-ink-4" : low ? "text-warn font-semibold" : "text-ink-2"
                      }`}
                    >
                      {cov === null ? "—" : `${cov}%`}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-3">
        “—” means the key isn’t present on the event. Conversion events with no EMQ or composite &lt; 6 are the ones
        that break attribution.
      </p>
    </div>
  );
}

function FbcPanel({ audit }: { audit: AuditSnapshot }) {
  const pct = audit.fbcCoverage;
  const under = pct < audit.fbcTarget;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-2">fbc (click-ID) coverage</span>
        <span className={`text-lg font-bold num ${under ? "text-warn" : "text-brand"}`}>{pct}%</span>
      </div>
      <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
        <div
          className={`h-full rounded-full ${under ? "bg-warn" : "bg-brand"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-ink-3"
          style={{ left: `${audit.fbcTarget}%` }}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Target ~{audit.fbcTarget}%. Below it, click-through matching degrades and Meta drops attribution it would
        otherwise credit.
      </p>
    </div>
  );
}

function VolumeTable({ audit }: { audit: AuditSnapshot }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[0.7rem] uppercase tracking-wide text-ink-3">
            <th className="py-2 pr-3 font-semibold">Event</th>
            <th className="py-2 px-3 font-semibold text-right">Web</th>
            <th className="py-2 px-3 font-semibold text-right">Server</th>
            <th className="py-2 px-3 font-semibold text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {audit.eventVolume.map((v) => (
            <tr key={v.event} className="border-b border-line/60">
              <td className="py-2.5 pr-3 font-medium text-ink">{v.event}</td>
              <td className="py-2.5 px-3 text-right num text-ink-2">{v.web}</td>
              <td className={`py-2.5 px-3 text-right num ${v.event === "Lead" && v.server === 0 ? "text-warn font-semibold" : "text-ink-2"}`}>
                {v.server}
              </td>
              <td className="py-2.5 px-3 text-right num font-semibold text-ink">{v.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-3">Raw event counts by source (before browser/server dedup).</p>
    </div>
  );
}

function AdSetsTable({ audit }: { audit: AuditSnapshot }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[0.7rem] uppercase tracking-wide text-ink-3">
            <th className="py-2 pr-3 font-semibold">Ad set</th>
            <th className="py-2 px-3 font-semibold">Status</th>
            <th className="py-2 px-3 font-semibold">Optimizing</th>
            <th className="py-2 px-3 font-semibold text-right">Spend</th>
            <th className="py-2 px-3 font-semibold text-right">Impr.</th>
            <th className="py-2 px-3 font-semibold text-right">Leads</th>
          </tr>
        </thead>
        <tbody>
          {audit.adSets.map((a) => (
            <tr key={a.name} className="border-b border-line/60">
              <td className="py-2.5 pr-3 font-medium text-ink">{a.name}</td>
              <td className="py-2.5 px-3"><StatusChip status={a.status} /></td>
              <td className="py-2.5 px-3 text-ink-2">{a.optimizationGoal.replace(/_/g, " ").toLowerCase()}</td>
              <td className="py-2.5 px-3 text-right num text-ink-2">{a.spend ?? "—"}</td>
              <td className="py-2.5 px-3 text-right num text-ink-2">{a.impressions ?? "—"}</td>
              <td className="py-2.5 px-3 text-right num text-ink-3">{a.attributedLeads}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({
  n, title, icon: Icon, medallion = "", subtitle, children,
}: {
  n: string; title: string; icon: LucideIcon; medallion?: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <section className="panel reveal">
      <div className="panel-head">
        <div className="flex items-center gap-2.5">
          <span className={`medallion ${medallion} !h-7 !w-7 !rounded-[9px]`}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">
              <span className="text-ink-4">{n}</span>&nbsp;&nbsp;{title}
            </h2>
            {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

export function AuditView({ audit, history }: { audit: AuditSnapshot; history: AuditSnapshot[] }) {
  const criticals = audit.flags.filter((f) => f.severity === "critical").length;

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">Marketing · Tracking QA</p>
        <h1 className="page-title">Meta Ads tracking QA</h1>
        <p className="mt-1 text-sm text-ink-2">
          {audit.account.name} · {audit.pixel.name} ({audit.pixel.id}) · {audit.windowLabel}
        </p>
        <p className="mt-0.5 text-xs text-ink-3">Generated {fmtDateTime(audit.generatedAt)}</p>
      </div>

      {/* Verdict banner */}
      <div className="panel reveal overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="medallion medallion-danger !h-10 !w-10 shrink-0">
              <AlertOctagon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink">
                Lead attribution is broken — {audit.attributionGap.pixelLeads} at the pixel, {audit.attributionGap.metaAttributedLeads} attributed
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-2">
                The Lead event fires fine but has <span className="font-semibold text-danger">no Event Match Quality</span>,
                so Meta can’t match it and credits the campaign 0 Website Leads. fbc coverage ({audit.fbcCoverage}%) and a
                browser-only Lead compound it.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="chip chip-danger">{criticals} critical</span>
          </div>
        </div>
      </div>

      <Section n="01" title="Flags" icon={AlertTriangle} medallion="medallion-warn"
        subtitle="Sorted by severity — critical first">
        <FlagsPanel flags={audit.flags} />
      </Section>

      <Section n="02" title="Optimization vs signal" icon={Target} medallion="medallion-info"
        subtitle={`${audit.campaign.name} · ${audit.campaign.objective}`}>
        <OptimizationPanel audit={audit} />
        <p className="mt-3 text-xs text-ink-3">
          All three active ad sets optimize for OFFSITE_CONVERSIONS on the Lead event. The event is the right one and it
          is firing — but with no EMQ, Meta receives no usable conversion signal to optimize toward.
        </p>
      </Section>

      <Section n="03" title="Attribution gap" icon={Gauge} medallion="medallion-danger"
        subtitle={audit.attributionGap.window}>
        <AttributionGapPanel audit={audit} />
      </Section>

      <Section n="04" title="Event Match Quality" icon={Target} medallion="medallion-warn"
        subtitle="Composite score + match-key coverage per event">
        <EmqTable rows={audit.emq} />
      </Section>

      <Section n="05" title="fbc (click-ID) coverage" icon={Gauge} medallion="medallion-warn">
        <FbcPanel audit={audit} />
      </Section>

      <Section n="06" title="Event volume" icon={Radio} medallion="medallion-info"
        subtitle="Web vs server · last 7 days">
        <VolumeTable audit={audit} />
      </Section>

      <Section n="07" title="Ad sets" icon={Layers} medallion="medallion-info"
        subtitle="Optimization goal + Meta-attributed leads">
        <AdSetsTable audit={audit} />
      </Section>

      <Section n="08" title="Pixel health" icon={Radio} medallion="medallion-brand">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-ink-3">Status</div>
            <div className="font-semibold text-brand">{audit.pixel.active ? "Active" : "Inactive"}</div>
          </div>
          <div>
            <div className="text-xs text-ink-3">Last fired</div>
            <div className="font-medium text-ink">{fmtDateTime(audit.pixel.lastFired)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-3">Uploads</div>
            <div className="font-medium text-ink capitalize">{audit.pixel.uploadFrequency}</div>
          </div>
          <div>
            <div className="text-xs text-ink-3">CAPI Gateway</div>
            <div className="font-medium text-warn">{audit.pixel.capiGateway.replace(/_/g, " ").toLowerCase()}</div>
          </div>
        </div>
      </Section>

      {history.length > 0 && (
        <Section n="09" title="Previous weeks" icon={Layers} medallion="">
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.weekEnding} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 py-2 text-sm last:border-0">
                <span className="font-medium text-ink">{h.windowLabel}</span>
                <span className="text-ink-2">
                  Pixel <span className="num font-semibold">{h.attributionGap.pixelLeads}</span> · Attributed{" "}
                  <span className="num font-semibold text-danger">{h.attributionGap.metaAttributedLeads}</span> · fbc{" "}
                  <span className="num">{h.fbcCoverage}%</span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
