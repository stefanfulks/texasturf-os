"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createMaintenanceLog } from "@/lib/warehouse/actions";
import type {
  MaintenanceScheduleOption,
  VehicleAssetOption,
} from "@/lib/warehouse/queries";

const field =
  "field-input";
const label = "field-label";

export function NewMaintenanceForm({
  assets,
  prefillAssetId,
}: {
  assets: VehicleAssetOption[];
  prefillAssetId: string | null;
}) {
  const [assetId, setAssetId] = useState<string>(prefillAssetId ?? "");
  const [schedules, setSchedules] = useState<MaintenanceScheduleOption[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Default service date = today (YYYY-MM-DD)
  const today = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();

  // When an asset is picked, fetch its active schedules so the user can
  // attribute this log to one (advances last_serviced markers). Clearing
  // schedules synchronously on empty assetId is intentional — we don't want
  // a stale list flashing while the user re-picks. Matches the
  // set-state-in-effect carve-out used elsewhere (see nav-links.tsx).
  useEffect(() => {
    if (!assetId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSchedules([]);
      return;
    }
    setSchedulesLoading(true);
    fetch(`/api/operations/maintenance-schedules?asset_id=${encodeURIComponent(assetId)}`)
      .then((r) => r.ok ? r.json() : { schedules: [] })
      .then((d: { schedules?: MaintenanceScheduleOption[] }) => {
        setSchedules(d.schedules ?? []);
      })
      .catch(() => setSchedules([]))
      .finally(() => setSchedulesLoading(false));
  }, [assetId]);

  async function handleSubmit(formData: FormData) {
    setSubmitError(null);
    startTransition(async () => {
      try {
        await createMaintenanceLog(formData);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("NEXT_REDIRECT")) return;
        setSubmitError(msg);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <Section title="Vehicle">
        <div>
          <label className={label}>Vehicle *</label>
          <select
            name="asset_id"
            required
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className={field}
          >
            <option value="">— pick a vehicle —</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.identifier ? ` (${a.identifier})` : ""}
                {" · "}{a.unit_type.replace("_", " ")}
              </option>
            ))}
          </select>
          {assets.length === 0 && (
            <p className="mt-1 text-xs text-ink-3">
              No active vehicles. Add one in{" "}
              <Link href="/operations/assets" className="underline">Assets</Link> first.
            </p>
          )}
        </div>

        <div>
          <label className={label}>
            Linked schedule (optional)
            {schedulesLoading && <span className="ml-2 text-ink-4">loading…</span>}
          </label>
          <select name="schedule_id" defaultValue="" className={field} disabled={!assetId || schedulesLoading}>
            <option value="">— none —</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.next_due_at ? ` · due ${new Date(s.next_due_at).toLocaleDateString()}` : ""}
                {s.next_due_meter != null ? ` · due @ ${s.next_due_meter}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-3">
            Picking one bumps last_serviced_at + last_serviced_meter on that schedule.
          </p>
        </div>
      </Section>

      <Section title="Service">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Service date *</label>
            <input
              type="date"
              name="performed_at"
              required
              defaultValue={today}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Odometer / hours</label>
            <input
              type="number" inputMode="decimal"
              min="0"
              step="0.01"
              name="meter_value"
              placeholder="Optional"
              className={field}
            />
          </div>
        </div>
        <div>
          <label className={label}>Description *</label>
          <input
            name="description"
            required
            placeholder="e.g. Oil change + tire rotation"
            className={field}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Vendor / shop</label>
            <input name="vendor" placeholder="e.g. Discount Tire" className={field} />
          </div>
          <div>
            <label className={label}>Performed by (vendor — legacy)</label>
            <input
              name="performed_by_vendor"
              placeholder="If different from vendor"
              className={field}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Cost (USD)</label>
            <input
              type="number" inputMode="decimal"
              min="0"
              step="0.01"
              name="cost"
              placeholder="0.00"
              className={field}
            />
          </div>
          <div>
            <label className={label}>Invoice URL</label>
            <input
              name="invoice_url"
              placeholder="Receipt / invoice link"
              className={field}
            />
          </div>
        </div>
      </Section>

      <Section title="Notes">
        <textarea name="notes" rows={3} placeholder="Optional…" className={`${field} resize-none`} />
      </Section>

      {submitError && (
        <p className="rounded-lg border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Link href="/operations/vehicles" className="px-4 py-2 text-sm text-ink-2 hover:text-ink">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary disabled:opacity-50"
        >
          {isPending ? "Logging…" : "Log service"}
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
