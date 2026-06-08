import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listEmployees,
  listJobberVisitsForPicker,
  listJobberClientsForPicker,
} from "@/lib/warehouse/queries";
import { NewPullListForm } from "./new-pull-list-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New pull list · TexasTurf OS" };

export default async function NewPullListPage() {
  // Anyone can read; only admin/office can write (enforced by RLS). We still
  // require a signed-in user here so the form doesn't load for anon.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [employees, visits, clients] = await Promise.all([
    listEmployees({ activeOnly: true }),
    listJobberVisitsForPicker({ days: 30 }),
    listJobberClientsForPicker({ limit: 200 }),
  ]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New Pull List</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Build today&apos;s pull list. Sign-offs and status moves happen on the
          detail page once it&apos;s saved.
        </p>
      </div>
      <NewPullListForm
        employees={employees.map((e) => ({ id: e.id, display_name: e.display_name }))}
        visits={visits}
        clients={clients}
      />
    </div>
  );
}
