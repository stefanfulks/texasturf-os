"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Two manual-sync buttons (clients + visits). Triggers the admin-only
 * sync routes via POST, then refreshes the page so the new counts show.
 */
export function SyncButtons({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"clients" | "visits" | "jobs" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function sync(kind: "clients" | "visits" | "jobs") {
    setBusy(kind); setMsg(null); setErr(null);
    try {
      const url = kind === "visits"
        ? `/api/jobber/sync/visits?account=${encodeURIComponent(accountId)}&days=14`
        : kind === "jobs"
        ? `/api/jobber/sync/jobs?account=${encodeURIComponent(accountId)}`
        : `/api/jobber/sync/clients?account=${encodeURIComponent(accountId)}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? `Sync failed (${res.status})`);
      } else {
        setMsg(`Synced ${data.synced} ${kind}.`);
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const baseBtn =
    "rounded-lg px-3 py-2 text-sm font-medium border border-line bg-white hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => sync("clients")}
          disabled={busy !== null || isPending}
          className={baseBtn}
        >
          {busy === "clients" ? "Syncing clients…" : "Sync all clients"}
        </button>
        <button
          type="button"
          onClick={() => sync("visits")}
          disabled={busy !== null || isPending}
          className={baseBtn}
        >
          {busy === "visits" ? "Syncing visits…" : "Sync visits (±7 days)"}
        </button>
        <button
          type="button"
          onClick={() => sync("jobs")}
          disabled={busy !== null || isPending}
          className={baseBtn}
        >
          {busy === "jobs" ? "Syncing jobs…" : "Sync all jobs"}
        </button>
      </div>
      {msg && <p className="text-xs text-brand">{msg}</p>}
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}
