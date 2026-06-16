import Link from "next/link";
import { getDecks } from "@/lib/pitch/queries";
import { seedDefaultDeck, createDeck } from "./actions";
import type { StoredSlide } from "@/lib/pitch/deck";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

export default async function DecksPage() {
  const decks = await getDecks();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="display text-2xl">Decks</h1>
        <Link href="/pitch" className="btn btn-line">Back to Pitch</Link>
      </div>

      {decks.length === 0 ? (
        <form action={seedDefaultDeck} className="card p-5">
          <p className="text-sm text-ink-2 mb-3">No decks yet. Create the starter deck to begin arranging your pitch.</p>
          <button className="btn btn-primary">Create starter deck</button>
        </form>
      ) : (
        <>
          <ul className="space-y-2 mb-6">
            {decks.map((d) => {
              const shown = Array.isArray(d.slides) ? (d.slides as StoredSlide[]).filter((s) => !s.hidden).length : 0;
              return (
                <li key={d.id}>
                  <Link href={`/pitch/decks/${d.id}`} className="card card-hover p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {d.name}
                        {d.is_default && <span className="chip chip-brand ml-2">Default</span>}
                      </p>
                      <p className="text-xs text-ink-3">{shown} slides shown</p>
                    </div>
                    <span className="chip chip-neutral">Edit</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <form action={createDeck} className="card p-4 flex items-end gap-3">
            <label className="flex-1 text-xs font-medium text-ink-3">New deck name
              <input name="name" placeholder="Putting green" className={field} />
            </label>
            <button className="btn btn-primary">Create</button>
          </form>
        </>
      )}
    </div>
  );
}
