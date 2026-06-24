import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLookups } from "../_lib/queries";
import { RequestForm } from "./request-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Vendor Order Request · TexasTurf OS" };

export default async function NewVendorOrderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lookups = await getLookups(supabase);
  const me = lookups.profiles.find((p) => p.id === user.id);
  const buyers = lookups.profiles.filter((p) => ["admin", "office"].includes(p.role));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/operations/vendor-orders" className="text-sm text-ink-3 hover:underline">← Vendor Orders</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New Vendor Order Request</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          Quick intake — takes under 30 seconds. Purchasing fills in vendor &amp; payment details later.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <RequestForm
          buyers={buyers}
          projects={lookups.projects}
          defaultRequestedBy={me?.full_name || me?.email || ""}
          defaultBuyerId={me && ["admin", "office"].includes(me.role) ? me.id : ""}
        />
      </div>
    </div>
  );
}
