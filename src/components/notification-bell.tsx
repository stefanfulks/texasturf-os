"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/database.types";

// Project notifications render under /jobs/[id] — the OS "projects" table is
// the same data and there is no /projects route on disk. Audit P0: the
// previous /projects/${id} href 404'd for every project notification.
//
// Feedback notifications send everyone to the personal feedback list
// (admins can jump to /admin/feedback from their workspace menu). There
// is no /feedback/[id] detail view yet — roadmap item.
const RESOURCE_HREFS: Record<string, (id: string) => string> = {
  task:     (id) => `/tasks/${id}`,
  project:  (id) => `/jobs/${id}`,
  invoice:  (id) => `/invoices/${id}`,
  feedback: () => `/feedback`,
};

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const [loaded, setLoaded] = useState(false);
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Realtime subscription for new notifications
  useEffect(() => {
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev]);
          setUnread((prev) => prev + 1);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  async function loadNotifications() {
    if (loaded) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications((data ?? []) as Notification[]);
    setLoaded(true);
  }

  async function markAllRead() {
    startTransition(async () => {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    });
  }

  async function markOneRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnread((prev) => Math.max(0, prev - 1));
  }

  function handleOpen() {
    setOpen((o) => !o);
    loadNotifications();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-[10px] text-ink-3 hover:text-ink hover:bg-hover transition-colors"
        aria-label="Notifications"
      >
        {/* Bell icon */}
        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-line bg-surface shadow-pop z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-ink-3 hover:text-brand transition-colors">
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-line">
            {!loaded ? (
              <div className="py-8 text-center text-sm text-ink-4">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-ink-4">No notifications yet</div>
            ) : (
              notifications.map((n) => {
                const href = n.resource_type && n.resource_id
                  ? RESOURCE_HREFS[n.resource_type]?.(n.resource_id) ?? null
                  : null;
                const content = (
                  <div className={`px-4 py-3 ${!n.read ? "bg-brand-tint/45" : ""}`}>
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand" />
                      )}
                      <div className={`flex-1 min-w-0 ${n.read ? "pl-3.5" : ""}`}>
                        <p className="text-sm font-medium text-ink leading-snug">{n.title}</p>
                        {n.body && <p className="text-xs text-ink-3 mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-xs text-ink-4 mt-1">
                          {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                if (href) {
                  return (
                    <Link
                      key={n.id}
                      href={href}
                      onClick={() => { if (!n.read) markOneRead(n.id); setOpen(false); }}
                      className="block row-link"
                    >
                      {content}
                    </Link>
                  );
                }
                return (
                  <div key={n.id} onClick={() => { if (!n.read) markOneRead(n.id); }} className="cursor-default">
                    {content}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
