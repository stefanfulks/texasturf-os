"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createPullList } from "@/lib/warehouse/actions";

type EmployeeOpt = { id: string; display_name: string };
type VisitOpt = {
  id: string;
  title: string | null;
  starts_at: string | null;
  client_id: string | null;
  client_name: string | null;
};
type ClientOpt = { id: string; name: string };

type RollRow = { roll_number: string; lengths_needed: string };

const field =
  "field-input";
const label = "field-label";

export function NewPullListForm({
  employees,
  visits,
  clients,
}: {
  employees: EmployeeOpt[];
  visits: VisitOpt[];
  clients: ClientOpt[];
}) {
  const [rolls, setRolls] = useState<RollRow[]>([
    { roll_number: "", lengths_needed: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // When a Jobber visit is picked, auto-fill the client + title fields.
  const [selectedVisitId, setSelectedVisitId] = useState<string>("");

  function onVisitChange(visitId: string) {
    setSelectedVisitId(visitId);
    if (!visitId) return;
    const v = visits.find((x) => x.id === visitId);
    if (!v) return;
    const clientSelect = document.querySelector<HTMLSelectElement>("[name=client_id]");
    if (clientSelect && v.client_id) clientSelect.value = v.client_id;
    const clientNameInput = document.querySelector<HTMLInputElement>("[name=client_name]");
    if (clientNameInput && !clientNameInput.value && v.client_name) {
      clientNameInput.value = v.client_name;
    }
    const jobNumberInput = document.querySelector<HTMLInputElement>("[name=job_number]");
    if (jobNumberInput && !jobNumberInput.value && v.title) {
      jobNumberInput.value = v.title;
    }
  }

  function addRoll() {
    setRolls((cur) => [...cur, { roll_number: "", lengths_needed: "" }]);
  }
  function removeRoll(i: number) {
    setRolls((cur) => (cur.length === 1 ? cur : cur.filter((_, idx) => idx !== i)));
  }
  function updateRoll(i: number, key: keyof RollRow, value: string) {
    setRolls((cur) => cur.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createPullList(formData);
      } catch (e) {
        // createPullList redirects on success; only error paths land here.
        // Next throws a redirect "error" sentinel — surface real errors only.
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("NEXT_REDIRECT")) return;
        setError(msg);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* ─── Job info ────────────────────────────────────────────────── */}
      <Section title="Job info">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Job date *</label>
            <input
              type="date"
              name="job_date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Job number / title</label>
            <input name="job_number" placeholder="e.g. Smith backyard" className={field} />
          </div>
        </div>

        <div>
          <label className={label}>Jobber visit (optional)</label>
          <select
            name="jobber_visit_id"
            value={selectedVisitId}
            onChange={(e) => onVisitChange(e.target.value)}
            className={field}
          >
            <option value="">— pick a visit to auto-fill —</option>
            {visits.map((v) => (
              <option key={v.id} value={v.id}>
                {fmtDate(v.starts_at)} · {v.client_name ?? "(no client)"} · {v.title ?? "(no title)"}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Client (Jobber)</label>
            <select name="client_id" defaultValue="" className={field}>
              <option value="">— none —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Client name (override)</label>
            <input name="client_name" placeholder="If not in Jobber yet" className={field} />
          </div>
        </div>

        <div>
          <label className={label}>Address</label>
          <input name="address" placeholder="Street, City" className={field} />
        </div>
      </Section>

      {/* ─── Crew ────────────────────────────────────────────────────── */}
      <Section title="Crew assignments">
        <CrewRow role="crew_lead" label="Crew lead" employees={employees} />
        <CrewRow role="driver"    label="Driver"    employees={employees} />
        <CrewRow role="stager"    label="Stager"    employees={employees} />
      </Section>

      {/* ─── Turf header ─────────────────────────────────────────────── */}
      <Section title="Turf">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Product</label>
            <input name="turf_product" placeholder="e.g. ProPlay Plus" className={field} />
          </div>
          <div>
            <label className={label}>Batch number</label>
            <input name="turf_batch_number" className={field} />
          </div>
          <div>
            <label className={label}>Linear runs</label>
            <input name="turf_linear_runs" placeholder="e.g. 18, 14, 12" className={field} />
          </div>
          <div>
            <label className={label}>Total sqft</label>
            <input name="turf_total_sqft" type="number" inputMode="decimal" step="0.01" min="0" className={field} />
          </div>
        </div>
      </Section>

      {/* ─── Rolls ───────────────────────────────────────────────────── */}
      <Section title="Rolls">
        <div className="space-y-2">
          {rolls.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
              <input
                name="roll_number"
                value={r.roll_number}
                onChange={(e) => updateRoll(i, "roll_number", e.target.value)}
                placeholder={`Roll # ${i + 1}`}
                className={field}
              />
              <input
                name="lengths_needed"
                value={r.lengths_needed}
                onChange={(e) => updateRoll(i, "lengths_needed", e.target.value)}
                placeholder="Lengths needed (e.g. 18, 14, 12)"
                className={field}
              />
              <button
                type="button"
                onClick={() => removeRoll(i)}
                disabled={rolls.length === 1}
                className="text-ink-4 hover:text-ink-2 disabled:opacity-30 text-xs px-2"
                aria-label="Remove roll"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRoll}
            className="text-xs font-medium text-ink-2 hover:text-ink px-2 py-1 rounded border border-dashed border-line-strong hover:border-line-strong"
          >
            + Add roll
          </button>
        </div>
      </Section>

      {/* ─── Loose materials ─────────────────────────────────────────── */}
      <Section title="Loose materials">
        <div>
          <label className={label}>Warehouse</label>
          <textarea name="loose_warehouse" rows={2} className={`${field} resize-none`} />
        </div>
        <div>
          <label className={label}>Yard — delivery</label>
          <textarea name="loose_yard_delivery" rows={2} className={`${field} resize-none`} />
        </div>
        <div>
          <label className={label}>Yard — pickup</label>
          <textarea name="loose_yard_pickup" rows={2} className={`${field} resize-none`} />
        </div>
      </Section>

      {/* ─── Bagged products ─────────────────────────────────────────── */}
      <Section title="Bagged products">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="bagged_none" className="rounded border-line-strong" />
          <span>None on this job</span>
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BagInput name="bagged_standard_sand" label="Standard sand" />
          <BagInput name="bagged_fine_sand"     label="Fine sand"     />
          <BagInput name="bagged_wonderfill"    label="Wonderfill"    />
          <BagInput name="bagged_misc"          label="Misc"          />
        </div>
      </Section>

      {/* ─── Fasteners & supplies ────────────────────────────────────── */}
      <Section title="Fasteners & supplies">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BagInput name="nails_boxes"    label="Nails (boxes)"    />
          <BagInput name="staples_boxes"  label="Staples (boxes)"  />
          <BagInput name="glue_gal"       label="Glue (gal)"       />
          <BagInput name="seam_tape_rolls" label="Seam tape (rolls)" />
        </div>
        <div>
          <label className={label}>Weed barrier</label>
          <input name="weed_barrier" placeholder="e.g. 1 × 12'×100' roll" className={field} />
        </div>
      </Section>

      {/* ─── Notes ───────────────────────────────────────────────────── */}
      <Section title="Notes">
        <textarea name="notes" rows={3} placeholder="Anything special the crew should know…" className={`${field} resize-none`} />
      </Section>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Sticky on phones so the submit is always a thumb away on this
          long form — the daily warehouse workflow. */}
      <div className="form-actions">
        <Link
          href="/operations/pull-lists"
          className="px-4 py-2 text-sm text-ink-2 hover:text-ink"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary h-11 px-5 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create pull list"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 space-y-3">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function CrewRow({
  role,
  label: roleLabel,
  employees,
}: {
  role: "crew_lead" | "driver" | "stager";
  label: string;
  employees: EmployeeOpt[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={label}>{roleLabel}</label>
        <select name={`${role}_employee_id`} defaultValue="" className={field}>
          <option value="">— pick someone —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.display_name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>{roleLabel} (free text)</label>
        <input name={role} placeholder="Used if not in employees list" className={field} />
      </div>
    </div>
  );
}

function BagInput({ name, label: l }: { name: string; label: string }) {
  return (
    <div>
      <label className={label}>{l}</label>
      <input type="number" inputMode="decimal" min="0" name={name} defaultValue={0} className={field} />
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day:   "numeric",
    hour:  "numeric",
    minute:"2-digit",
  });
}
