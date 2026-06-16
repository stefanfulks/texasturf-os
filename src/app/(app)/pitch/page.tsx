import Link from "next/link";
import { getRecentSessions } from "@/lib/pitch/queries";

export default async function PitchHomePage() {
  const sessions = await getRecentSessions();
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="display text-2xl">Pitch</h1>
        <div className="flex gap-2">
          <Link href="/pitch/decks" className="btn btn-line">Decks</Link>
          <Link href="/pitch/new" className="btn btn-primary">New pitch</Link>
        </div>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-ink-3">No pitches yet. Start one before your next estimate.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/present/${s.id}`} className="card card-hover p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.prospect_name ?? "Untitled pitch"}</p>
                  <p className="text-xs text-ink-3">{s.address ?? "—"} · {s.status}</p>
                </div>
                <span className="chip chip-neutral">Open</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
