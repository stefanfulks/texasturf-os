import Link from "next/link";
import { redirect } from "next/navigation";
import { Phone, PhoneCall, Plus, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCallLists } from "@/lib/dialer/queries";

export const dynamic = "force-dynamic";

/**
 * Dialer index — every call list (team-shared, spec §7), with per-list
 * progress and a "My lists" filter driven by ?mine=1.
 */
export default async function DialerIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { mine } = await searchParams;
  const showMine = mine === "1";

  const allLists = await getCallLists();
  const lists = showMine ? allLists.filter((l) => l.owner_id === user.id) : allLists;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1 flex items-center gap-1.5">
            <PhoneCall className="h-3.5 w-3.5" aria-hidden />
            Sales · Power Dialer
          </p>
          <h1 className="page-title">Call lists</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-2">
            Build a list, open it, and work it one person at a time — dial, log
            the outcome, next. Your phone rings first, then we connect them.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/sales/dialer/new" className="btn btn-primary">
            <Plus className="h-4 w-4" aria-hidden /> New list
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Link
          href="/sales/dialer"
          className={`chip ${!showMine ? "bg-ink text-white" : ""}`}
        >
          All lists
        </Link>
        <Link
          href="/sales/dialer?mine=1"
          className={`chip ${showMine ? "bg-ink text-white" : ""}`}
        >
          My lists
        </Link>
      </div>

      {!lists.length ? (
        <div className="panel">
          <div className="empty-state">
            <span className="medallion medallion-brand">
              <Phone className="h-5 w-5" />
            </span>
            <p className="empty-state-title">No call lists yet</p>
            <p className="empty-state-body">
              Create one from sales contacts, Jobber clients, or TurfCasa
              customers, then dial straight through it.
            </p>
            <Link href="/sales/dialer/new" className="btn btn-primary mt-3">
              New list
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => {
            const pct = l.totalItems ? Math.round((l.calledItems / l.totalItems) * 100) : 0;
            return (
              <Link key={l.id} href={`/sales/dialer/${l.id}`} className="stat stat-interactive stat-accent-brand">
                <div className="flex items-center justify-between gap-2">
                  <p className="stat-label truncate">{l.name}</p>
                  {l.brand === "turfcasa" && (
                    <span className="chip inline-flex items-center gap-1 text-xs">
                      <Store className="h-3 w-3" aria-hidden /> TurfCasa
                    </span>
                  )}
                </div>
                <p className="stat-value num">
                  {l.calledItems} / {l.totalItems}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="stat-foot">
                  {l.status === "active" ? "active" : l.status}
                  {l.ownerName ? ` · ${l.ownerName}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
