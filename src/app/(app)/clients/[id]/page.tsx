import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EmailEntry = { address?: string; description?: string };
type PhoneEntry = { number?: string; description?: string };

function clientName(c: {
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): string {
  return (
    c.company_name ||
    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
    "Unnamed client"
  );
}

function money(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function jobStatusChip(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("complete")) return "chip chip-brand";
  if (s.includes("active") || s.includes("progress")) return "chip chip-info";
  if (s.includes("invoic")) return "chip chip-warn";
  if (s.includes("archiv") || s.includes("cancel")) return "chip chip-neutral";
  return "chip chip-neutral";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: clientRow } = await supabase
    .from("jobber_clients")
    .select("id, first_name, last_name, company_name, emails, phones, balance_cents, is_archived, raw")
    .eq("id", id)
    .maybeSingle();

  if (!clientRow) notFound();
  const client = clientRow as unknown as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    emails: EmailEntry[] | null;
    phones: PhoneEntry[] | null;
    balance_cents: number | null;
    is_archived: boolean;
    raw: { jobberWebUri?: string } | null;
  };

  // Jobs + visits both carry client_id. Pull in parallel.
  const [jobsRes, visitsRes] = await Promise.all([
    supabase
      .from("jobber_jobs")
      .select("id, job_number, title, status, start_at, end_at, completed_at, total_cents")
      .eq("client_id", id)
      .order("start_at", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("jobber_visits")
      .select("id, title, starts_at, is_complete")
      .eq("client_id", id)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  const jobs = (jobsRes.data ?? []) as unknown as Array<{
    id: string; job_number: string | null; title: string | null; status: string | null;
    start_at: string | null; end_at: string | null; completed_at: string | null; total_cents: number | null;
  }>;
  const visits = (visitsRes.data ?? []) as unknown as Array<{
    id: string; title: string | null; starts_at: string | null; is_complete: boolean;
  }>;

  const name = clientName(client);
  const emails = (client.emails ?? []).map((e) => e.address).filter(Boolean) as string[];
  const phones = (client.phones ?? []).map((p) => p.number).filter(Boolean) as string[];
  const jobberUrl = client.raw?.jobberWebUri;
  const owesMoney = (client.balance_cents ?? 0) > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="reveal">
        <Link href="/clients" className="text-xs font-medium text-ink-3 hover:text-brand transition-colors">
          ← Clients
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="display text-2xl text-ink flex items-center gap-2">
              {name}
              {client.is_archived && <span className="chip chip-neutral">Archived</span>}
            </h1>
            {(emails.length > 0 || phones.length > 0) && (
              <p className="mt-1.5 text-sm text-ink-3">
                {[...emails, ...phones].join("  ·  ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {jobberUrl && (
              <a href={jobberUrl} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-sm">
                Open in Jobber ↗
              </a>
            )}
            <Link href="/tasks" className="btn btn-primary btn-sm">
              New task
            </Link>
          </div>
        </div>
      </div>

      {/* At-a-glance */}
      <div className="reveal grid grid-cols-3 gap-3" style={{ animationDelay: "60ms" }}>
        <div className="card p-4">
          <p className="eyebrow">Balance</p>
          <p className={`mt-1.5 display text-xl tabular-nums ${owesMoney ? "text-danger" : "text-ink"}`}>
            {money(client.balance_cents)}
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Jobs</p>
          <p className="mt-1.5 display text-xl tabular-nums text-ink">{jobs.length}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Visits</p>
          <p className="mt-1.5 display text-xl tabular-nums text-ink">{visits.length}</p>
        </div>
      </div>

      {/* Jobs */}
      <section className="reveal panel" style={{ animationDelay: "120ms" }}>
        <div className="panel-head">
          <h2 className="text-sm font-semibold text-ink">Jobs</h2>
          <span className="text-xs text-ink-4">{jobs.length} total</span>
        </div>
        {jobs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-ink-2">No jobs synced for this client.</p>
            <p className="mt-1 text-xs text-ink-4">Jobber jobs appear here once synced.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink truncate">
                    {j.title || (j.job_number ? `Job ${j.job_number}` : "Untitled job")}
                  </p>
                  <p className="text-xs text-ink-4 tabular-nums">
                    {j.job_number ? `#${j.job_number}` : ""}
                    {j.start_at ? `${j.job_number ? " · " : ""}${fmtDate(j.start_at)}` : ""}
                    {j.completed_at ? ` · done ${fmtDate(j.completed_at)}` : ""}
                  </p>
                </div>
                {j.status && <span className={jobStatusChip(j.status)}>{j.status.replace(/_/g, " ")}</span>}
                <span className="w-20 text-right text-sm tabular-nums text-ink-2 shrink-0">
                  {money(j.total_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Visits */}
      <section className="reveal panel" style={{ animationDelay: "180ms" }}>
        <div className="panel-head">
          <h2 className="text-sm font-semibold text-ink">Visits</h2>
          <span className="text-xs text-ink-4">{visits.length} total</span>
        </div>
        {visits.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-ink-2">No visits synced for this client.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {visits.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-24 text-xs tabular-nums text-ink-3 shrink-0">{fmtDate(v.starts_at)}</span>
                <span className="flex-1 min-w-0 truncate text-sm text-ink">{v.title || "Visit"}</span>
                {v.is_complete && <span className="chip chip-brand">Done</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
