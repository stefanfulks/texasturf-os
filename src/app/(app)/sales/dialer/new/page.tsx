import { redirect } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ListBuilder } from "./list-builder";

export const dynamic = "force-dynamic";

/**
 * New call list — pick people from sales contacts (stage/segment/source
 * filters), Jobber clients (search), or TurfCasa order customers (deduped by
 * phone). `?brand=turfcasa` (the /turfcasa entry point) preselects the
 * TurfCasa source + brand.
 */
export default async function NewCallListPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { brand } = await searchParams;
  const initialBrand = brand === "turfcasa" ? "turfcasa" : "texasturf";

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 flex items-center gap-1.5">
          <PhoneCall className="h-3.5 w-3.5" aria-hidden />
          Sales · Power Dialer
        </p>
        <h1 className="page-title">New call list</h1>
      </div>
      <ListBuilder initialBrand={initialBrand} />
    </div>
  );
}
