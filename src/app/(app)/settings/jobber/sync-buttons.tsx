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
  const [busy, setBusy] = useState<"clients" | "visits" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function sync(kind: "clients" | "visits") {
    setBusy(kind); setMsg(null); setErr(null);
    try {
      const url = kind === "visits"
        ? `/api/jobber/sync/visits?account=${encodeURIComponent(accountId)}&days=14`
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
    "rounded-lg px-3 py-2 text-sm font-medium border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed";

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
      </div>
      {msg && <p className="text-xs text-green-700">{msg}</p>}
      {err && <p className="text-xs text-red-700">{err}</p>}
    </div>
  );
}
