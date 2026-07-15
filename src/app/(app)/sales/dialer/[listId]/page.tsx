import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PhoneCall, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCallList, getListItems } from "@/lib/dialer/queries";
import { DialerScreen } from "./dialer-screen";

export const dynamic = "force-dynamic";

/** Active dialer (spec §7) — the working screen, one person at a time. */
export default async function ActiveDialerPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { listId } = await params;
  const list = await getCallList(listId);
  if (!list) notFound();
  const items = await getListItems(listId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/sales/dialer"
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All call lists
          </Link>
          <h1 className="page-title flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-brand" aria-hidden />
            {list.name}
            {list.brand === "turfcasa" && (
              <span className="chip chip-warn inline-flex items-center gap-1 text-xs">
                <Store className="h-3 w-3" aria-hidden /> TurfCasa
              </span>
            )}
          </h1>
          {list.description && <p className="mt-1 text-sm text-ink-2">{list.description}</p>}
        </div>
      </div>

      <DialerScreen listId={list.id} initialItems={items} />
    </div>
  );
}
