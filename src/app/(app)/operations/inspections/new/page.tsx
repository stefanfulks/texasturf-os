import Link from "next/link";
import { createInspection } from "@/lib/warehouse/actions";
import { listAssets, listEmployees } from "@/lib/warehouse/queries";
import { INSPECTION_CHECKLIST } from "@/lib/warehouse/types";

export const dynamic = "force-dynamic";

export default async function NewInspectionPage() {
  const [employees, trucks, trailers, equipment] = await Promise.all([
    listEmployees({ activeOnly: true }),
    listAssets({ kind: "truck", activeOnly: true }),
    listAssets({ kind: "trailer", activeOnly: true }),
    listAssets({ kind: "heavy_equipment", activeOnly: true }),
  ]);

  return (
    <main className="min-h-dvh bg-hover px-8 py-12 dark:bg-ink">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">New inspection</h1>
          <Link href="/operations/inspections" className="text-sm text-ink-3 hover:underline">
            ← Inspections
          </Link>
        </div>

        <form action={createInspection} className="mt-6 space-y-8">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <Field label="Inspector">
              <input
                name="inspector"
                required
                placeholder="Name"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm dark:border-line-strong dark:bg-ink"
              />
            </Field>
            <Field label="Inspector (linked employee)">
              <EmployeeSelect name="inspector_employee_id" employees={employees} />
            </Field>
            <Field label="Truck">
              <AssetSelect name="truck_id" assets={trucks} placeholder="— select truck —" />
            </Field>
            <Field label="Trailer (optional)">
              <AssetSelect name="trailer_id" assets={trailers} placeholder="— none —" />
            </Field>
            <Field label="Heavy equipment (optional)">
              <AssetSelect name="equipment_id" assets={equipment} placeholder="— none —" />
            </Field>
          </fieldset>

          {INSPECTION_CHECKLIST.map((section) => (
            <fieldset key={section.section} className="rounded-lg border border-line p-4 dark:border-line-strong">
              <legend className="px-1 text-sm font-medium">{section.label}</legend>
              <div className="mt-2 space-y-2">
                {section.items.map((item) => (
                  <ChecklistRow
                    key={item.key}
                    name={`items.${section.section}.${item.key}`}
                    label={item.label}
                  />
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset className="rounded-lg border border-line p-4 dark:border-line-strong">
            <legend className="px-1 text-sm font-medium">Result</legend>
            <div className="mt-2 flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="result" value="pass" defaultChecked /> Pass
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="result" value="fail" /> Fail
              </label>
            </div>
            <p className="mt-2 text-xs text-ink-3">
              Auto-set to <em>fail</em> if any item is marked No, unless explicitly overridden.
            </p>
            <div className="mt-3">
              <label className="block text-sm font-medium">Failure notes</label>
              <textarea
                name="failure_notes"
                rows={3}
                placeholder="If FAIL, document the issues here."
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm dark:border-line-strong dark:bg-ink"
              />
            </div>
          </fieldset>

          <div className="flex justify-end gap-3">
            <Link
              href="/operations/inspections"
              className="rounded-md border border-line px-4 py-2 text-sm dark:border-line-strong"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink dark:bg-white dark:text-ink dark:hover:bg-line"
            >
              Save inspection
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block font-medium">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function ChecklistRow({ name, label }: { name: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-1 last:border-0 dark:border-line-strong">
      <span className="text-sm">{label}</span>
      <div className="flex shrink-0 gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input type="radio" name={name} value="yes" defaultChecked /> Yes
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" name={name} value="no" /> No
        </label>
        <label className="flex items-center gap-1 text-ink-3">
          <input type="radio" name={name} value="na" /> N/A
        </label>
      </div>
    </div>
  );
}

function EmployeeSelect({
  name,
  employees,
}: {
  name: string;
  employees: { id: string; display_name: string }[];
}) {
  return (
    <select
      name={name}
      className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm dark:border-line-strong dark:bg-ink"
      defaultValue=""
    >
      <option value="">— optional —</option>
      {employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.display_name}
        </option>
      ))}
    </select>
  );
}

function AssetSelect({
  name,
  assets,
  placeholder,
}: {
  name: string;
  assets: { id: string; name: string; identifier: string | null }[];
  placeholder: string;
}) {
  return (
    <select
      name={name}
      className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm dark:border-line-strong dark:bg-ink"
      defaultValue=""
    >
      <option value="">{placeholder}</option>
      {assets.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
          {a.identifier ? ` (${a.identifier})` : ""}
        </option>
      ))}
    </select>
  );
}
