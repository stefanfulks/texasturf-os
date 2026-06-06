import Link from "next/link";
import { listEmployees } from "@/lib/warehouse/queries";
import { createEmployee } from "@/lib/warehouse/actions";
import type { EmployeeRole } from "@/lib/warehouse/types";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<EmployeeRole, string> = {
  warehouse: "Warehouse",
  driver: "Driver",
  stager: "Stager",
  crew_lead: "Crew Lead",
  installer: "Installer",
  office: "Office",
  admin: "Admin",
  contractor: "Contractor",
  other: "Other",
};

export default async function EmployeesPage() {
  const employees = await listEmployees();

  return (
    <main className="min-h-dvh bg-zinc-50 px-8 py-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Employees</h1>
          <Link href="/operations" className="text-sm text-zinc-500 hover:underline">
            ← Warehouse
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Used by pull-list assignments, inspections, deliveries, maintenance and tool purchase logs.
        </p>

        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-medium">Add employee</h2>
          <form action={createEmployee} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input name="first_name" label="First name" required />
            <Input name="last_name" label="Last name" />
            <label className="block text-sm">
              <span className="block font-medium">Role</span>
              <select
                name="role"
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                defaultValue=""
              >
                <option value="">— optional —</option>
                {(Object.keys(ROLE_LABELS) as EmployeeRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <Input name="email" label="Email" type="email" />
            <Input name="phone" label="Phone" />
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Add employee
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2 font-medium">{e.display_name}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {e.role ? ROLE_LABELS[e.role] : "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{e.email ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{e.phone ?? "—"}</td>
                  <td className="px-3 py-2">{e.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                    No employees yet. Add one above.
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
  type,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="block font-medium">{label}</span>
      <input
        name={name}
        type={type ?? "text"}
        required={required}
        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
      />
    </label>
  );
}
