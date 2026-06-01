"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Quick search on the dashboard. v1 forwards to the inventory rolls page
 * (which already searches across tag, mfg #, product, SKU, location,
 * dye-lot, and notes). Later we'll fan this out to invoices + tasks too.
 */
export function DashboardQuickSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    // Route to the deep search surface (inventory rolls), which supports
    // SKU / location / mfg# / tag / dye lot / notes.
    router.push(`/inventory/rolls?search=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={submit} className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search inventory — SKU, tag, product, location…"
        className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-400"
      />
      <button
        type="submit"
        disabled={!q.trim()}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-40 px-2 py-0.5 rounded"
        title="Search (Enter)"
      >
        ↵
      </button>
    </form>
  );
}
