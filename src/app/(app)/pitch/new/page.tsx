"use client";
import { useActionState } from "react";
import { createPitchSession, type NewPitchState } from "./actions";

const initial: NewPitchState = { error: null };
const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

export default function NewPitchPage() {
  const [state, formAction, isPending] = useActionState(createPitchSession, initial);
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="display text-2xl mb-1">New pitch</h1>
      <p className="text-sm text-ink-3 mb-4">Private setup — the client never sees this screen.</p>
      <form action={formAction} className="card p-4 space-y-3">
        <label className="block text-xs font-medium text-ink-3">Prospect name
          <input name="prospect_name" placeholder="Jane Homeowner" className={field} />
        </label>
        <label className="block text-xs font-medium text-ink-3">Address
          <input name="address" placeholder="123 Oak St, Plano TX" className={field} />
        </label>
        <label className="block text-xs font-medium text-ink-3">Install area (sq ft)
          <input type="number" name="installedSqft" min="1" required placeholder="800" className={field} />
        </label>
        <label className="block text-xs font-medium text-ink-3">Surface
          <select name="application" defaultValue="soil" className={field}>
            <option value="soil">Soil / dirt</option>
            <option value="concrete">Concrete</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-ink-3">Tear-out tier (1 easiest – 10 hardest)
          <select name="tearoutTier" defaultValue="1" className={field}>
            {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </label>
        <label className="block text-xs font-medium text-ink-3">Access
          <select name="access" defaultValue="normal" className={field}>
            <option value="normal">Normal</option>
            <option value="difficult">Difficult</option>
          </select>
        </label>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <button type="submit" disabled={isPending} className="btn btn-primary w-full disabled:opacity-50">
          {isPending ? "Building…" : "Start presenting"}
        </button>
      </form>
    </div>
  );
}
