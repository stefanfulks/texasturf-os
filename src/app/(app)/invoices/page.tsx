import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, InvoiceStatus, Vendor } from "@/lib/database.types";

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; badge: string; dot: string }> = {
  draft:              { label: "Draft",              badge: "bg-zinc-100 text-zinc-500",    dot: "bg-zinc-300"   },
  submitted:          { label: "Submitted",          badge: "bg-blue-50 text-blue-700",     dot: "bg-blue-400"   },
  ocr_processing:     { label: "Processing",         badge: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-400" },
  ocr_review_needed:  { label: "OCR Review",         badge: "bg-amber-50 text-amber-700",   dot: "bg-amber-400"  },
  awaiting_review:    { label: "Awaiting Review",    badge: "bg-yellow-50 text-yellow-700", dot: "bg-yellow-400" },
  awaiting_approval:  { label: "Awaiting Approval",  badge: "bg-orange-50 text-orange-700", dot: "bg-orange-400" },
  approved:           { label: "Approved",           badge: "bg-green-50 text-green-700",   dot: "bg-green-500"  },
  request_change:     { label: "Needs Changes",      badge: "bg-red-50 text-red-700",       dot: "bg-red-500"    },
  rejected:           { label: "Rejected",           badge: "bg-red-100 text-red-800",      dot: "bg-red-600"    },
  on_hold:            { label: "On Hold",            badge: "bg-zinc-100 text-zinc-500",    dot: "bg-zinc-400"   },
  paid:               { label: "Paid",               badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  archived:           { label: "Archived",           badge: "bg-zinc-50 text-zinc-400",     dot: "bg-zinc-200"   },
};

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {isOfficeOrAdmin && (
            <Link
              href={`/api/invoices/export?month=${currentMonth}&year=${currentYear}`}
              className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Export CSV
            </Link>
          )}
          <Link
            href="/invoices/new"
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Submit Invoice
          </Link>
        </div>
      </div>

      {/* Stats (admin/office only) */}
      {isOfficeOrAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Needs Action", value: needsAction,            color: needsAction > 0 ? "text-orange-600 font-semibold" : "text-zinc-400" },
            { label: "Awaiting Approval", value: stats["awaiting_approval"] ?? 0, color: "text-zinc-900" },
            { label: "Approved (unpaid)", value: stats["approved"]  ?? 0, color: "text-green-700" },
            { label: "Paid (this run)",   value: stats["paid"]      ?? 0, color: "text-emerald-700" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
              <p className="text-xs text-zinc-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_GROUPS.map((group) => {
            const active = (status ?? "All") === group.label || (group.label === "All" && !status);
            return (
              <Link
                key={group.label}
                href={group.label === "All" ? "/invoices" : `/invoices?status=${encodeURIComponent(group.label)}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                }`}
              >
                {group.label}
              </Link>
            );
          })}
        </div>

        {/* Search */}
        <form method="GET" className="flex-1 max-w-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search invoices…"
            className="w-full text-sm border border-zinc-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
          />
        </form>
      </div>

      {/* Invoice list */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">
            No invoices found.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map((inv) => {
              const statusCfg = STATUS_CONFIG[inv.status as InvoiceStatus];
              return (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors group"
                >
                  {/* Status dot */}
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 group-hover:underline truncate">{inv.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {inv.vendor?.name ?? "No vendor"}
                      {inv.customer_name && ` · ${inv.customer_name}`}
                      {inv.service_period_start && ` · ${format(parseISO(inv.service_period_start), "MMM d")}${inv.service_period_end ? `–${format(parseISO(inv.service_period_end), "d")}` : ""}`}
                    </p>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-3 flex-shrink-0 text-right">
                    {inv.total_amount != null && (
                      <span className="text-sm font-semibold text-zinc-900">
                        ${inv.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.badge}`}>
                      {statusCfg.label}
                    </span>
                    <span className="text-xs text-zinc-400">
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
