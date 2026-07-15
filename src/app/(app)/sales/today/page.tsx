import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckSquare, PhoneCall, PhoneForwarded, Store, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTodayData } from "@/lib/calls/coaching";

export const dynamic = "force-dynamic";

/**
 * BDR "Today" queue (calling suite Phase 4): the rep's active call lists,
 * due call-generated follow-up tasks, and callbacks due — one place to start
 * the day and stay in.
 */
export default async function SalesTodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { myLists, dueTasks, callbacks } = await getTodayData(user.id);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 flex items-center gap-1.5">
          <Sun className="h-3.5 w-3.5" aria-hidden />
          Sales · Today
        </p>
        <h1 className="page-title">Your calling day</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-2">
          Lists to work, callbacks you promised, and the follow-ups the AI
          pulled out of your calls.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat stat-accent-brand">
          <p className="stat-label">Dials waiting</p>
          <p className="stat-value num">{myLists.reduce((n, l) => n + l.pending, 0)}</p>
          <p className="stat-foot">across {myLists.length} active list{myLists.length === 1 ? "" : "s"}</p>
        </div>
        <div className="stat stat-accent-info">
          <p className="stat-label">Callbacks due</p>
          <p className="stat-value num">{callbacks.length}</p>
          <p className="stat-foot">promised times, today or overdue</p>
        </div>
        <div className="stat stat-accent-warn">
          <p className="stat-label">Follow-up tasks</p>
          <p className="stat-value num">{dueTasks.length}</p>
          <p className="stat-foot">created from your calls</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* My lists */}
        <div className="panel">
          <div className="panel-head flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <PhoneCall className="h-4 w-4" aria-hidden /> My call lists
            </p>
            <Link href="/sales/dialer/new" className="text-xs font-medium text-ink-3 hover:text-ink">
              New list
            </Link>
          </div>
          {myLists.length ? (
            <ul className="divide-y divide-line">
              {myLists.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/sales/dialer/${l.id}`}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-sunken"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-medium text-ink">{l.name}</span>
                      {l.brand === "turfcasa" && (
                        <Store className="h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />
                      )}
                    </span>
                    <span className="chip chip-neutral shrink-0 text-xs">
                      {l.pending} to dial
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-3">
              No active lists you own — build one and start dialing.
            </p>
          )}
        </div>

        {/* Callbacks due */}
        <div className="panel">
          <div className="panel-head">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <PhoneForwarded className="h-4 w-4" aria-hidden /> Callbacks due
            </p>
          </div>
          {callbacks.length ? (
            <ul className="divide-y divide-line">
              {callbacks.map((c) => (
                <li key={c.attemptId}>
                  <Link
                    href={c.listId ? `/sales/dialer/${c.listId}` : "/sales/dialer"}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-sunken"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">
                        {c.targetName ?? c.targetPhone ?? "Unknown"}
                      </span>
                      <span className="block truncate text-xs text-ink-3">{c.targetPhone}</span>
                    </span>
                    <span className="chip chip-info shrink-0 text-xs">
                      {new Date(c.callbackAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-3">Nothing promised for today.</p>
          )}
        </div>
      </div>

      {/* Call-generated tasks */}
      <div className="panel">
        <div className="panel-head">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <CheckSquare className="h-4 w-4" aria-hidden /> Follow-ups from your calls
          </p>
        </div>
        {dueTasks.length ? (
          <ul className="divide-y divide-line">
            {dueTasks.map((t) => {
              const overdue = t.due_date && t.due_date < todayStr;
              return (
                <li key={t.id}>
                  <Link
                    href={`/tasks?task=${t.id}`}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-sunken"
                  >
                    <span className="min-w-0 truncate font-medium text-ink">{t.title}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {t.priority === "high" || t.priority === "urgent" ? (
                        <span className="chip chip-danger text-[10px]">{t.priority}</span>
                      ) : null}
                      <span className={`chip text-xs ${overdue ? "chip-danger" : "chip-neutral"}`}>
                        {t.due_date ?? t.status}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-3 text-sm text-ink-3">
            All clear — new ones land here automatically after each reviewed call.
          </p>
        )}
      </div>
    </div>
  );
}
