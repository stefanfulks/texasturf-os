"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/database.types";

// Project notifications render under /jobs/[id] — the OS "projects" table is
// the same data and there is no /projects route on disk. Audit P0: the
// previous /projects/${id} href 404'd for every project notification.
const RESOURCE_HREFS: Record<string, (id: string) => string> = {
  task:    (id) => `/tasks/${id}`,
  project: (id) => `/jobs/${id}`,
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
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
        aria-label="Notifications"
      >
        {/* Bell icon */}
        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-zinc-500 hover:text-zinc-900">
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-zinc-50">
            {!loaded ? (
              <div className="py-8 text-center text-sm text-zinc-400">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-400">No notifications yet</div>
            ) : (
              notifications.map((n) => {
                const href = n.resource_type && n.resource_id
                  ? RESOURCE_HREFS[n.resource_type]?.(n.resource_id) ?? null
                  : null;
                const content = (
                  <div className={`px-4 py-3 ${!n.read ? "bg-blue-50/60" : ""}`}>
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                      <div className={`flex-1 min-w-0 ${n.read ? "pl-3.5" : ""}`}>
                        <p className="text-sm font-medium text-zinc-900 leading-snug">{n.title}</p>
                        {n.body && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-xs text-zinc-400 mt-1">
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
                      className="block hover:bg-zinc-50 transition-colors"
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
