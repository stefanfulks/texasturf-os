import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobber Report · TexasTurf OS" };

// ─── Helpers ───────────────────────────────────────────────────────────────────

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

const STATUS_LABELS: Record<string, string> = {
  requires_invoicing: "Requires Invoicing",
  archived: "Archived",
  today: "Today",
  upcoming: "Upcoming",
  late: "Late",
  action_required: "Action Required",
  on_hold: "On Hold",
  unscheduled: "Unscheduled",
  active: "Active",
};

type JobRow = {
  status: string | null;
  total_cents: number | null;
  completed_at: string | null;
  jobber_created_at: string | null;
  client_id: string | null;
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function JobberReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";

  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const ago7d = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const ago30d = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  // Jobs: page through the full mirror (well past the 1k row cap).
  const jobs: JobRow[] = [];
  for (let fromRow = 0; ; fromRow += 1000) {
    const { data, error } = await supabase
      .from("jobber_jobs")
      .select("status, total_cents, completed_at, jobber_created_at, client_id")
      .range(fromRow, fromRow + 999);
    if (error) break;
    jobs.push(...((data ?? []) as JobRow[]));
    if (!data || data.length < 1000) break;
  }

  // Invoices: page through the mirror like jobs (also >1k rows). Untyped
  // client cast because jobber_invoices isn't in the generated types yet
  // (typegen is blocked until the next `supabase login`); the query also
  // tolerates the table not existing yet — the section just renders zeros.
  type InvoiceRow = {
    status: string | null;
    total_cents: number | null;
    balance_cents: number | null;
    issued_date: string | null;
  };
  const untyped = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
  const invoices: InvoiceRow[] = [];
  for (let fromRow = 0; ; fromRow += 1000) {
    const { data, error } = await untyped
      .from("jobber_invoices")
      .select("status, total_cents, balance_cents, issued_date")
      .range(fromRow, fromRow + 999);
    if (error) break;
    invoices.push(...((data ?? []) as InvoiceRow[]));
    if (!data || data.length < 1000) break;
  }

  const [
    upcomingVisitsRes,
    completedVisits7dRes,
    visits30dRes,
    visitsComplete30dRes,
    lastClientSyncRes,
    lastJobSyncRes,
    lastVisitSyncRes,
    clientCountRes,
  ] = await Promise.all([
    supabase.from("jobber_visits").select("id", { count: "exact", head: true })
      .gte("starts_at", now.toISOString()).lte("starts_at", in7d),
    supabase.from("jobber_visits").select("id", { count: "exact", head: true })
      .eq("is_complete", true).gte("starts_at", ago7d).lte("starts_at", now.toISOString()),
    supabase.from("jobber_visits").select("id", { count: "exact", head: true })
      .gte("starts_at", ago30d).lte("starts_at", now.toISOString()),
    supabase.from("jobber_visits").select("id", { count: "exact", head: true })
      .eq("is_complete", true).gte("starts_at", ago30d).lte("starts_at", now.toISOString()),
    supabase.from("jobber_clients").select("synced_at").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("jobber_jobs").select("synced_at").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("jobber_visits").select("synced_at").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("jobber_clients").select("id", { count: "exact", head: true }),
  ]);

  // Webhook health is admin-only (RLS) — query separately, tolerate empty.
  let lastWebhookAt: string | null = null;
  let webhookErrors24h = 0;
  if (isAdmin) {
    const [lastEvt, errCount] = await Promise.all([
      supabase.from("jobber_webhook_events").select("received_at")
        .order("received_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("jobber_webhook_events").select("id", { count: "exact", head: true })
        .not("process_error", "is", null)
        .gte("received_at", new Date(now.getTime() - 86_400_000).toISOString()),
    ]);
    lastWebhookAt = lastEvt.data?.received_at ?? null;
    webhookErrors24h = errCount.count ?? 0;
  }

  // ── Aggregations (in memory over the jobs mirror) ────────────────────────────

  const byStatus = new Map<string, { count: number; cents: number }>();
  for (const j of jobs) {
    const key = (j.status ?? "unknown").toLowerCase();
    const agg = byStatus.get(key) ?? { count: 0, cents: 0 };
    agg.count += 1;
    agg.cents += j.total_cents ?? 0;
    byStatus.set(key, agg);
  }
  const statusRows = [...byStatus.entries()].sort((a, b) => b[1].cents - a[1].cents);

  const months = lastMonths(6);
  const bookedByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  const completedByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  for (const j of jobs) {
    if (j.jobber_created_at) {
      const k = monthKey(j.jobber_created_at);
      if (bookedByMonth.has(k)) bookedByMonth.set(k, bookedByMonth.get(k)! + (j.total_cents ?? 0));
    }
    if (j.completed_at) {
      const k = monthKey(j.completed_at);
      if (completedByMonth.has(k)) completedByMonth.set(k, completedByMonth.get(k)! + (j.total_cents ?? 0));
    }
  }
  const maxMonthCents = Math.max(
    1,
    ...months.map((m) => Math.max(bookedByMonth.get(m) ?? 0, completedByMonth.get(m) ?? 0)),
  );

  const byClient = new Map<string, number>();
  for (const j of jobs) {
    if (!j.client_id) continue;
    byClient.set(j.client_id, (byClient.get(j.client_id) ?? 0) + (j.total_cents ?? 0));
  }
  const topClientIds = [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const { data: topClientRows } = topClientIds.length
    ? await supabase.from("jobber_clients")
        .select("id, first_name, last_name, company_name")
        .in("id", topClientIds.map(([id]) => id))
    : { data: [] };
  const clientNames = new Map(
    (topClientRows ?? []).map((c) => [
      c.id,
      [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company_name || "Unnamed client",
    ]),
  );

  const outstandingCents = invoices.reduce((s, i) => s + Math.max(0, i.balance_cents ?? 0), 0);
  const outstandingCount = invoices.filter((i) => (i.balance_cents ?? 0) > 0).length;
  const invoicedByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  for (const i of invoices) {
    if (!i.issued_date) continue;
    const k = monthKey(i.issued_date);
    if (invoicedByMonth.has(k)) invoicedByMonth.set(k, invoicedByMonth.get(k)! + (i.total_cents ?? 0));
  }
  const maxInvoiceMonth = Math.max(1, ...months.map((m) => invoicedByMonth.get(m) ?? 0));

  const totalPipelineCents = jobs.reduce((s, j) => s + (j.total_cents ?? 0), 0);
  const visits30d = visits30dRes.count ?? 0;
  const visitsComplete30d = visitsComplete30dRes.count ?? 0;
  const completionRate = visits30d > 0 ? Math.round((visitsComplete30d / visits30d) * 100) : null;

  const freshest = [lastClientSyncRes.data?.synced_at, lastJobSyncRes.data?.synced_at, lastVisitSyncRes.data?.synced_at]
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Jobber Report</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            Live view of the synced Jobber mirror — jobs, revenue, and visits.
          </p>
        </div>
        <Link
          href="/reports"
          className="px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-hover text-ink-2 text-sm font-medium transition-colors"
        >
          &larr; All reports
        </Link>
      </div>

      {/* Snapshot */}
      <section>
        <p className="text-sm font-semibold text-ink-3 uppercase tracking-wide mb-3">Snapshot</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-5">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">Jobs (all time)</p>
            <p className="text-2xl font-bold text-ink tabular-nums">{jobs.length.toLocaleString()}</p>
            <p className="text-xs text-ink-4 mt-1">{money(totalPipelineCents)} total value</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">Clients</p>
            <p className="text-2xl font-bold text-ink tabular-nums">{(clientCountRes.count ?? 0).toLocaleString()}</p>
            <p className="text-xs text-ink-4 mt-1">synced from Jobber</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">Visits next 7 days</p>
            <p className="text-2xl font-bold text-ink tabular-nums">{upcomingVisitsRes.count ?? 0}</p>
            <p className="text-xs text-ink-4 mt-1">{completedVisits7dRes.count ?? 0} completed last 7 days</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">30-day completion</p>
            <p className="text-2xl font-bold text-ink tabular-nums">
              {completionRate === null ? "—" : `${completionRate}%`}
            </p>
            <p className="text-xs text-ink-4 mt-1">
              {visitsComplete30d} of {visits30d} visits
            </p>
          </div>
        </div>
      </section>

      {/* Billing (from Jobber invoices) */}
      <section>
        <p className="text-sm font-semibold text-ink-3 uppercase tracking-wide mb-3">
          Billing (Jobber invoices)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          <div className="card p-5">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">Invoices synced</p>
            <p className="text-2xl font-bold text-ink tabular-nums">{invoices.length.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-line bg-warn-tint p-5">
            <p className="text-xs font-medium text-warn uppercase tracking-wide mb-1">Outstanding A/R</p>
            <p className="text-2xl font-bold text-warn tabular-nums">{money(outstandingCents)}</p>
            <p className="text-xs text-warn mt-1">{outstandingCount} invoice{outstandingCount !== 1 ? "s" : ""} with a balance</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">Invoiced this month</p>
            <p className="text-2xl font-bold text-ink tabular-nums">
              {money(invoicedByMonth.get(months[months.length - 1]) ?? 0)}
            </p>
          </div>
        </div>
        <div className="card p-5">
          <div className="space-y-2">
            {months.map((m) => {
              const cents = invoicedByMonth.get(m) ?? 0;
              return (
                <div key={m} className="grid grid-cols-[90px_1fr] items-center gap-3 text-sm">
                  <span className="text-ink-3">{monthLabel(m)}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 rounded-full bg-brand" style={{ width: `${Math.max(1, (cents / maxInvoiceMonth) * 100)}%` }} />
                    <span className="text-xs text-ink-3 tabular-nums whitespace-nowrap">{money(cents)} invoiced</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Revenue by month */}
      <section>
        <p className="text-sm font-semibold text-ink-3 uppercase tracking-wide mb-3">
          Job Value by Month (last 6 months)
        </p>
        <div className="card p-5">
          <div className="space-y-3">
            {months.map((m) => {
              const booked = bookedByMonth.get(m) ?? 0;
              const completed = completedByMonth.get(m) ?? 0;
              return (
                <div key={m} className="grid grid-cols-[90px_1fr] items-center gap-3 text-sm">
                  <span className="text-ink-3">{monthLabel(m)}</span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 rounded-full bg-brand" style={{ width: `${Math.max(1, (booked / maxMonthCents) * 100)}%` }} />
                      <span className="text-xs text-ink-3 tabular-nums whitespace-nowrap">{money(booked)} booked</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 rounded-full bg-ink-4/40" style={{ width: `${Math.max(1, (completed / maxMonthCents) * 100)}%` }} />
                      <span className="text-xs text-ink-4 tabular-nums whitespace-nowrap">{money(completed)} completed</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Pipeline by status */}
        <section>
          <p className="text-sm font-semibold text-ink-3 uppercase tracking-wide mb-3">Jobs by Status</p>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3 uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Jobs</th>
                  <th className="px-4 py-2.5 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map(([status, agg]) => (
                  <tr key={status} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-ink">{STATUS_LABELS[status] ?? status}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{agg.count.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{money(agg.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top clients */}
        <section>
          <p className="text-sm font-semibold text-ink-3 uppercase tracking-wide mb-3">Top Clients by Job Value</p>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3 uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {topClientIds.map(([id, cents]) => (
                  <tr key={id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/clients/${id}`} className="text-ink hover:underline underline-offset-2">
                        {clientNames.get(id) ?? "Unnamed client"}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{money(cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Data freshness */}
      <section>
        <p className="text-sm font-semibold text-ink-3 uppercase tracking-wide mb-3">Data Freshness</p>
        <div className="card p-5 text-sm space-y-2">
          <p className="text-ink-2">
            Last sync:{" "}
            <span className="font-medium text-ink">
              {freshest ? new Date(freshest).toLocaleString() : "never"}
            </span>{" "}
            <span className="text-ink-4">(auto-sync runs twice daily; webhooks update between runs)</span>
          </p>
          {isAdmin && (
            lastWebhookAt ? (
              <p className="text-ink-2">
                Last webhook event: <span className="font-medium text-ink">{new Date(lastWebhookAt).toLocaleString()}</span>
                {webhookErrors24h > 0 && (
                  <span className="ml-2 rounded bg-warn-tint px-1.5 text-warn">{webhookErrors24h} errors in 24h</span>
                )}
              </p>
            ) : (
              <p className="rounded-lg border border-warn/30 bg-warn-tint px-3 py-2 text-warn">
                No webhook events have ever been received — live updates are off. Configure the
                webhook URL and topics in the Jobber Developer Center, then events will flow here.
              </p>
            )
          )}
        </div>
      </section>
    </div>
  );
}
