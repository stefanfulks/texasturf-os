import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssistantChat } from "./chat";

export const metadata = { title: "Turfy · TexasTurf OS" };

export default async function AssistantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const greetingName =
    profile?.full_name?.split(" ")[0] ??
    profile?.email?.split("@")[0] ??
    "there";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Turfy</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          Ask anything about tasks, invoices, inventory, vendors. I look things
          up in your live data — I don&apos;t make stuff up.
        </p>
      </div>
      <AssistantChat greetingName={greetingName} />
    </div>
  );
}
