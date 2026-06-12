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
    <main className="min-h-dvh bg-hover px-8 py-12 dark:bg-ink">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Employees</h1>
          <Link href="/operations" className="text-sm text-ink-3 hover:underline">
            ← Warehouse
          </Link>
        </div>
        <p className="mt-1 text-sm text-ink-2 dark:text-ink-4">
          Used by pull-list assignments, inspections, deliveries, maintenance and tool purchase logs.
        </p>

        <section className="mt-8 rounded-lg border border-line bg-white p-5 dark:border-line-strong dark:bg-ink">
          <h2 className="text-sm font-medium">Add employee</h2>
          <form action={createEmployee} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input name="first_name" label="First name" required />
            <Input name="last_name" label="Last name" />
            <label className="block text-sm">
              <span className="block font-medium">Role</span>
              <select
                name="role"
                className="mt-1 field-input"
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
                className="btn btn-primary"
              >
                Add employee
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-line dark:border-line-strong">
          <table className="w-full text-sm">
            <thead className="bg-sunken text-left dark:bg-ink">
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
                <tr key={e.id} className="border-t border-line dark:border-line-strong">
                  <td className="px-3 py-2 font-medium">{e.display_name}</td>
                  <td className="px-3 py-2 text-ink-2 dark:text-ink-4">
                    {e.job_role ? ROLE_LABELS[e.job_role] : "—"}
                  </td>
                  <td className="px-3 py-2 text-ink-2 dark:text-ink-4">{e.email ?? "—"}</td>
                  <td className="px-3 py-2 text-ink-2 dark:text-ink-4">{e.phone ?? "—"}</td>
                  <td className="px-3 py-2">{e.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-ink-3">
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
        className="mt-1 field-input"
      />
    </label>
  );
}
