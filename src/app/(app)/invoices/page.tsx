import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { AlertCircle, Clock, CheckCircle2, Banknote, Download, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, InvoiceStatus } from "@/lib/db-helpers.types";
import { INVOICE_STATUS_CONFIG as STATUS_CONFIG } from "@/lib/invoices/status";

const FILTER_GROUPS = [
  { label: "All",             statuses: null },
  { label: "Needs Action",    statuses: ["awaiting_review","awaiting_approval","ocr_review_needed","request_change"] },
  { label: "Approved",        statuses: ["approved"] },
  { label: "Paid",            statuses: ["paid"] },
  { label: "Submitted",       statuses: ["submitted","ocr_processing"] },
  { label: "Archived",        statuses: ["archived"] },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  const now          = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear  = now.getFullYear();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isOfficeOrAdmin = profile?.role === "admin" || profile?.role === "office";

  // Build query — field users only see their own
  // "Archived" filter explicitly shows archived; every other filter hides them.
  const isArchivedView = status === "Archived";
  let query = supabase
    .from("invoices")
    .select("*, vendor:vendor_id(id, name)")
    .order("submitted_at", { ascending: false })
    .limit(100);

  if (isArchivedView) {
    query = query.eq("status", "archived");
  } else {
    query = query.neq("status", "archived");
  }

  if (!isOfficeOrAdmin) query = query.eq("submitted_by_id", user.id);

  if (status && status !== "all" && !isArchivedView) {
    const group = FILTER_GROUPS.find((g) => g.label === status);
    if (group?.statuses) {
      query = query.in("status", group.statuses as InvoiceStatus[]);
    }
  }

  const { data: invoicesRaw } = await query;
  const invoices = (invoicesRaw ?? []) as unknown as Array<Invoice & { vendor: { id: string; name: string } | null }>;

  // Stats for office/admin
  let stats: Record<string, number> = {};
  if (isOfficeOrAdmin) {
    const { data: allInvoices } = await supabase
      .from("invoices")
      .select("status")
      .neq("status", "archived");
    if (allInvoices) {
      stats = allInvoices.reduce((acc, inv) => {
        acc[inv.status] = (acc[inv.status] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
  }

  const needsAction = (stats["awaiting_review"] ?? 0) + (stats["awaiting_approval"] ?? 0) + (stats["request_change"] ?? 0) + (stats["ocr_review_needed"] ?? 0);

  // Client-side text search
  const filtered = q
    ? invoices.filter((inv) => {
        const haystack = [
          inv.title,
          inv.vendor?.name,
          inv.invoice_number,
          inv.customer_name,
          inv.job_name,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(q.toLowerCase());
      })
    : invoices;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="reveal flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="eyebrow mb-2">Office</p>
          <h1 className="page-title">Invoices</h1>
          <p className="page-sub">{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {isOfficeOrAdmin && (
            <Link
              href={`/api/invoices/export?month=${currentMonth}&year=${currentYear}`}
              className="btn btn-line"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Link>
          )}
          <Link href="/invoices/new" className="btn btn-primary">
            <Plus className="h-4 w-4" /> Submit invoice
          </Link>
        </div>
      </header>

      {/* Stats (admin/office only) */}
      {isOfficeOrAdmin && (
        <div className="reveal grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: "60ms" }}>
          {[
            { label: "Needs action", value: needsAction, icon: AlertCircle, accent: needsAction > 0 ? "stat-accent-warn" : "", medallion: needsAction > 0 ? "medallion-warn" : "medallion-brand" },
            { label: "Awaiting approval", value: stats["awaiting_approval"] ?? 0, icon: Clock, accent: "", medallion: "medallion-brand" },
            { label: "Approved (unpaid)", value: stats["approved"] ?? 0, icon: CheckCircle2, accent: "", medallion: "medallion-brand" },
            { label: "Paid (this run)", value: stats["paid"] ?? 0, icon: Banknote, accent: "stat-accent-brand", medallion: "medallion-brand" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`stat ${s.accent}`}>
                <div className="flex items-start justify-between">
                  <span className="stat-label">{s.label}</span>
                  <span className={`medallion ${s.medallion} !h-7 !w-7 !rounded-[9px]`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <span className="stat-value">{s.value}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter + Search */}
      <div className="reveal flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "120ms" }}>
        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_GROUPS.map((group) => {
            const active = (status ?? "All") === group.label || (group.label === "All" && !status);
            return (
              <Link
                key={group.label}
                href={group.label === "All" ? "/invoices" : `/invoices?status=${encodeURIComponent(group.label)}`}
                className={"chip " + (active ? "border-brand-strong bg-brand text-on-brand" : "chip-outline hover:bg-hover")}
              >
                {group.label}
              </Link>
            );
          })}
        </div>

        {/* Search */}
        <form method="GET" className="max-w-sm flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search invoices…"
              className="field-input !pl-9"
            />
          </div>
        </form>
      </div>

      {/* Invoice list */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-4">
            No invoices found.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((inv) => {
              const statusCfg = STATUS_CONFIG[inv.status as InvoiceStatus];
              return (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-hover transition-colors group"
                >
                  {/* Status dot */}
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink group-hover:underline truncate">{inv.title}</p>
                    <p className="text-xs text-ink-4 mt-0.5">
                      {inv.vendor?.name ?? "No vendor"}
                      {inv.customer_name && ` · ${inv.customer_name}`}
                      {inv.service_period_start && ` · ${format(parseISO(inv.service_period_start), "MMM d")}${inv.service_period_end ? `–${format(parseISO(inv.service_period_end), "d")}` : ""}`}
                    </p>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-3 flex-shrink-0 text-right">
                    {inv.total_amount != null && (
                      <span className="text-sm font-semibold text-ink">
                        ${inv.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.badge}`}>
                      {statusCfg.label}
                    </span>
                    <span className="text-xs text-ink-4">
                      {format(parseISO(inv.submitted_at), "MMM d")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
