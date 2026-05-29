import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InventorySubnav } from "@/components/inventory-subnav";

export default async function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "field") {
    redirect("/");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <InventorySubnav />
      {children}
    </div>
  );
}
