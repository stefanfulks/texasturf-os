import Link from "next/link";
import { listAssets } from "@/lib/warehouse/queries";
import { createAsset } from "@/lib/warehouse/actions";
import type { AssetKind } from "@/lib/warehouse/types";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<AssetKind, string> = {
  truck: "Truck",
  trailer: "Trailer",
  heavy_equipment: "Heavy Equipment",
  tool: "Tool",
};

export default async function AssetsPage() {
  const assets = await listAssets();

  return (
    <main className="min-h-dvh bg-hover px-8 py-12 dark:bg-ink">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Assets</h1>
          <Link href="/operations" className="text-sm text-ink-3 hover:underline">
            ← Warehouse
          </Link>
        </div>
        <p className="mt-1 text-sm text-ink-2 dark:text-ink-4">
          Trucks, trailers, heavy equipment, and tracked tools. Used by inspections + maintenance.
        </p>

        <section className="mt-8 rounded-lg border border-line bg-white p-5 dark:border-line-strong dark:bg-ink">
          <h2 className="text-sm font-medium">Add asset</h2>
          <form action={createAsset} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="block font-medium">Kind</span>
              <select
                name="kind"
                required
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm dark:border-line-strong dark:bg-ink"
                defaultValue="truck"
              >
                {(Object.keys(KIND_LABELS) as AssetKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <Input name="name" label="Name" placeholder="Truck 3" required />
            <Input name="identifier" label="Identifier" placeholder="Plate / VIN / Serial" />
            <Input name="make" label="Make" />
            <Input name="model" label="Model" />
            <Input name="year" label="Year" type="number" />
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink dark:bg-white dark:text-ink dark:hover:bg-line"
              >
                Add asset
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-line dark:border-line-strong">
          <table className="w-full text-sm">
            <thead className="bg-sunken text-left dark:bg-ink">
              <tr>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Identifier</th>
                <th className="px-3 py-2 font-medium">Make / Model / Year</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-t border-line dark:border-line-strong">
                  <td className="px-3 py-2">{KIND_LABELS[a.unit_type]}</td>
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2 text-ink-2 dark:text-ink-4">{a.identifier ?? "—"}</td>
                  <td className="px-3 py-2 text-ink-2 dark:text-ink-4">
                    {[a.make, a.model, a.year].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2 capitalize">{a.status.replace(/_/g, " ")}</td>
                </tr>
              ))}
              {assets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-ink-3">
                    No assets yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function Input({
  name,
  label,
  placeholder,
  type,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="block font-medium">{label}</span>
      <input
        name={name}
        type={type ?? "text"}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm dark:border-line-strong dark:bg-ink"
      />
    </label>
  );
}
