"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Search } from "lucide-react";
import { linkJobberJob } from "../actions";

export type JobberJobOption = {
  id: string;
  job_number: string | null;
  title: string | null;
  status: string | null;
};

function label(o: JobberJobOption): string {
  const num = o.job_number ? `#${o.job_number}` : "Job";
  return o.title ? `${num} · ${o.title}` : num;
}

/**
 * Office/admin control to connect an OS job to its Jobber job. Shows the
 * current link with Change/Unlink, or a searchable list of synced Jobber jobs.
 */
export function JobberJobPicker({
  projectId,
  current,
  options,
}: {
  projectId: string;
  current: JobberJobOption | null;
  options: JobberJobOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save(jobberJobId: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await linkJobberJob(projectId, jobberJobId);
      if (res.error) { setError(res.error); return; }
      setPicking(false);
      setQuery("");
      router.refresh();
    });
  }

  const q = query.trim().toLowerCase();
  const matches = (q
    ? options.filter((o) => `${o.job_number ?? ""} ${o.title ?? ""}`.toLowerCase().includes(q))
    : options
  ).slice(0, 8);

  // Linked and not actively changing → compact summary.
  if (current && !picking) {
    return (
      <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{label(current)}</p>
              {current.status && <p className="text-xs capitalize text-ink-4">{current.status.toLowerCase()}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button onClick={() => setPicking(true)} disabled={pending} className="text-xs font-medium text-ink-3 hover:text-ink disabled:opacity-50">Change</button>
            <button onClick={() => save(null)} disabled={pending} className="text-xs font-medium text-danger hover:underline disabled:opacity-50">Unlink</button>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    );
  }

  // Unlinked, or actively picking → search + results.
  return (
    <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Link a Jobber job</p>
        {current && (
          <button onClick={() => { setPicking(false); setQuery(""); }} className="text-xs text-ink-4 hover:text-ink-2">Cancel</button>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by job # or title…"
          className="field-input pl-8"
        />
      </div>
      {options.length === 0 ? (
        <p className="mt-3 text-xs text-ink-4">No synced Jobber jobs to choose from yet.</p>
      ) : (
        <ul className="mt-1">
          {matches.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => save(o.id)}
                disabled={pending}
                className="-mx-2 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-hover disabled:opacity-50"
              >
                <span className="truncate text-sm text-ink">{label(o)}</span>
                {o.status && <span className="shrink-0 text-[11px] capitalize text-ink-4">{o.status.toLowerCase()}</span>}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="py-2 text-xs text-ink-4">No matches.</li>}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
