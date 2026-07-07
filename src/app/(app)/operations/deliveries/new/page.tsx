import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listEmployees,
  listJobberClientsForPicker,
  listPullListsForPicker,
} from "@/lib/warehouse/queries";
import { NewDeliveryForm } from "./new-delivery-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log delivery · TexasTurf OS" };

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ pull_list_id?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { pull_list_id: prefillPullListId } = await searchParams;

  const [employees, clients, pullLists] = await Promise.all([
    listEmployees({ activeOnly: true }),
    listJobberClientsForPicker({ limit: 200 }),
    listPullListsForPicker({ days: 14, limit: 100 }),
  ]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="page-title">Log delivery</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          Capture what landed at the job site. We&apos;ll auto-post to the
          warehouse Slack channel.
        </p>
      </div>
      <NewDeliveryForm
        employees={employees.map((e) => ({ id: e.id, display_name: e.display_name }))}
        clients={clients}
        pullLists={pullLists}
        prefillPullListId={prefillPullListId ?? null}
      />
    </div>
  );
}
