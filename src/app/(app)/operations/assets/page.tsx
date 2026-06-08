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
    <main className="min-h-dvh bg-zinc-50 px-8 py-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Assets</h1>
          <Link href="/operations" className="text-sm text-zinc-500 hover:underline">
            ← Warehouse
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Trucks, trailers, heavy equipment, and tracked tools. Used by inspections + maintenance.
        </p>

        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-medium">Add asset</h2>
          <form action={createAsset} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="block font-medium">Kind</span>
              <select
                name="kind"
                required
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
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
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Add asset
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
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
                <tr key={a.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{KIND_LABELS[a.unit_type]}</td>
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{a.identifier ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {[a.make, a.model, a.year].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2 capitalize">{a.status.replace(/_/g, " ")}</td>
                </tr>
              ))}
              {assets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
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
        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
      />
    </label>
  );
}
