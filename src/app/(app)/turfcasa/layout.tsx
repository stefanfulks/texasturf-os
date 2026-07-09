import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TurfcasaSubnav } from "@/components/turfcasa/turfcasa-subnav";

/**
 * TurfCasa — the sister-brand trade outlet section. Same team, same login,
 * different business: TexasTurf installs, TurfCasa supplies. Everything under
 * /turfcasa is outlet-side (trade accounts, quotes, invoices, catalog);
 * installation machinery stays in the TexasTurf sections.
 */
export default async function TurfcasaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="w-full mx-auto space-y-6">
      <TurfcasaSubnav />
      {children}
    </div>
  );
}
