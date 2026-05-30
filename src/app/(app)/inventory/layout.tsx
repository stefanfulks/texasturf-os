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

  if (!profile) redirect("/login");

  // field role gets view-only access — actions are still gated server-side.
  const readOnly = profile.role === "field";

  return (
    <div className="w-full mx-auto py-6 space-y-6">
      <InventorySubnav readOnly={readOnly} />
      {children}
    </div>
  );
}
