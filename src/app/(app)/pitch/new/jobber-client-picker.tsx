"use client";
import { useState, useTransition } from "react";
import { searchJobberClientsForPitch } from "./actions";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

export function JobberClientPicker() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; label: string }[]>([]);
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function search() {
    startTransition(async () => { setResults(await searchJobberClientsForPitch(q)); });
  }

  if (picked) {
    return (
      <div className="block text-xs font-medium text-ink-3">Jobber client — quote auto-builds in Jobber
        <input type="hidden" name="client_id" value={picked.id} />
        <div className="flex items-center justify-between rounded-lg border border-line bg-sunken px-3 py-2 mt-1">
          <span className="text-sm text-ink">{picked.label}</span>
          <button type="button" onClick={() => setPicked(null)} className="text-xs text-brand">Change</button>
        </div>
      </div>
    );
  }

  return (
    <div className="block text-xs font-medium text-ink-3">Link a Jobber client (optional — enables auto-quote + pay)
      <div className="flex gap-2 mt-1">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Jobber clients" className={field} />
        <button type="button" onClick={search} disabled={pending} className="btn btn-line shrink-0">{pending ? "…" : "Search"}</button>
      </div>
      {results.length > 0 && (
        <ul className="mt-1 border border-line rounded-lg divide-y divide-line overflow-hidden">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setPicked(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-hover">{r.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
