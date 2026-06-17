"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PitchPhotoDropzone, type PitchPhotoItem } from "@/components/pitch-photo-dropzone";
import { addArea, updateArea, removeArea, saveSiteDoc, addPitchPhoto, removePitchPhoto, markDocumented } from "./actions";
import type { PitchArea, PitchSiteDoc } from "@/lib/db-helpers.types";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

type AreaRow = { id: string; label: string; sqft: number; application: string; tearout: string; access: string };
type PhotoView = { id: string; areaId: string | null; category: string; path: string; name: string; url: string };

export function DocumentForm({
  userId,
  session,
  areas: initialAreas,
  siteDoc,
  photos,
}: {
  userId: string;
  session: { id: string; prospectName: string | null; address: string | null; status: string };
  areas: PitchArea[];
  siteDoc: PitchSiteDoc | null;
  photos: PhotoView[];
}) {
  const router = useRouter();
  const sessionId = session.id;

  const [areas, setAreas] = useState<AreaRow[]>(
    initialAreas.map((a) => ({
      id: a.id, label: a.label, sqft: Number(a.installed_sqft) || 0,
      application: a.application, tearout: a.tearout_tier, access: a.access,
    })),
  );
  const conditions0 = (siteDoc?.conditions ?? {}) as Record<string, unknown>;
  const use0 = (siteDoc?.use_notes ?? {}) as Record<string, unknown>;
  const [slope, setSlope] = useState(String(conditions0.slope_drainage ?? ""));
  const [sprinklers, setSprinklers] = useState(Boolean(conditions0.sprinklers));
  const [pets, setPets] = useState(Boolean(use0.pets));
  const [kids, setKids] = useState(Boolean(use0.kids));
  const [putting, setPutting] = useState(Boolean(use0.putting));
  const [problem, setProblem] = useState(String(use0.problem_areas ?? ""));
  const [notes, setNotes] = useState(String(use0.free_text ?? ""));
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const photosFor = (areaId: string, category: string): PitchPhotoItem[] =>
    photos.filter((p) => p.areaId === areaId && p.category === category).map((p) => ({ id: p.id, path: p.path, name: p.name, url: p.url }));

  async function onAddArea() {
    const res = await addArea(sessionId, `Area ${areas.length + 1}`);
    if ("id" in res) setAreas((a) => [...a, { id: res.id, label: `Area ${a.length + 1}`, sqft: 0, application: "soil", tearout: "1", access: "normal" }]);
  }
  async function onRemoveArea(id: string) {
    setAreas((a) => a.filter((x) => x.id !== id));
    await removeArea(sessionId, id);
  }
  function setField(id: string, patch: Partial<AreaRow>) {
    setAreas((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function save() {
    startSave(async () => {
      setMsg(null);
      for (const a of areas) {
        await updateArea(a.id, { label: a.label, installed_sqft: a.sqft, application: a.application, tearout_tier: a.tearout, access: a.access });
      }
      await saveSiteDoc(
        sessionId,
        { slope_drainage: slope, sprinklers },
        { pets, kids, putting, problem_areas: problem, free_text: notes },
      );
      await markDocumented(sessionId);
      setMsg("Saved — documentation captured.");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <div>
        <h1 className="display text-2xl">Document the site</h1>
        <p className="text-sm text-ink-3">
          {session.prospectName ?? "Prospect"}{session.address ? ` · ${session.address}` : ""} — capture areas, photos, conditions, and notes before you measure.
        </p>
      </div>

      {/* Areas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="display text-lg">Areas</h2>
          <button type="button" onClick={onAddArea} className="btn btn-line btn-sm">+ Add area</button>
        </div>
        {areas.length === 0 && <p className="text-sm text-ink-3">No areas yet. Add the backyard, side yard, pet area, putting green…</p>}
        {areas.map((a) => (
          <div key={a.id} className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input value={a.label} onChange={(e) => setField(a.id, { label: e.target.value })} className={field + " font-medium"} placeholder="Area name" />
              <button type="button" onClick={() => onRemoveArea(a.id)} className="btn btn-line btn-sm shrink-0">Remove</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="block text-xs font-medium text-ink-3">Sq ft
                <input type="number" min="0" value={a.sqft || ""} onChange={(e) => setField(a.id, { sqft: Number(e.target.value) })} className={field} />
              </label>
              <label className="block text-xs font-medium text-ink-3">Surface
                <select value={a.application} onChange={(e) => setField(a.id, { application: e.target.value })} className={field}>
                  <option value="soil">Soil / dirt</option>
                  <option value="concrete">Concrete</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-ink-3">Tear-out
                <select value={a.tearout} onChange={(e) => setField(a.id, { tearout: e.target.value })} className={field}>
                  {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-ink-3">Access
                <select value={a.access} onChange={(e) => setField(a.id, { access: e.target.value })} className={field}>
                  <option value="normal">Normal</option>
                  <option value="difficult">Difficult</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PitchPhotoDropzone userId={userId} sessionId={sessionId} label="Area photos" initial={photosFor(a.id, "area")}
                onAdded={(path, name) => addPitchPhoto(sessionId, "area", path, name, a.id)} onRemoved={removePitchPhoto} />
              <PitchPhotoDropzone userId={userId} sessionId={sessionId} label="Existing surface" initial={photosFor(a.id, "existing_surface")}
                onAdded={(path, name) => addPitchPhoto(sessionId, "existing_surface", path, name, a.id)} onRemoved={removePitchPhoto} />
            </div>
          </div>
        ))}
      </section>

      {/* Site conditions */}
      <section className="card p-4 space-y-3">
        <h2 className="display text-lg">Site conditions</h2>
        <label className="block text-xs font-medium text-ink-3">Slope / drainage
          <input value={slope} onChange={(e) => setSlope(e.target.value)} placeholder="e.g. slopes to back fence; low spot near patio" className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={sprinklers} onChange={(e) => setSprinklers(e.target.checked)} /> Sprinkler system present
        </label>
      </section>

      {/* Use & notes */}
      <section className="card p-4 space-y-3">
        <h2 className="display text-lg">Use &amp; notes</h2>
        <div className="flex flex-wrap gap-4 text-sm text-ink-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} /> Pets</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={kids} onChange={(e) => setKids(e.target.checked)} /> Kids</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={putting} onChange={(e) => setPutting(e.target.checked)} /> Wants putting green</label>
        </div>
        <label className="block text-xs font-medium text-ink-3">Problem areas
          <input value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="mud, dead grass, drainage…" className={field} />
        </label>
        <label className="block text-xs font-medium text-ink-3">Notes
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What the customer wants, anything to remember" className={field} />
        </label>
      </section>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        {msg && <p className="text-sm text-brand">{msg}</p>}
        <div className="flex gap-2 ml-auto">
          <Link href={`/present/${sessionId}`} className="btn btn-line">Hand to customer</Link>
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary disabled:opacity-50">
            {saving ? "Saving…" : "Save documentation"}
          </button>
        </div>
      </div>
    </div>
  );
}
