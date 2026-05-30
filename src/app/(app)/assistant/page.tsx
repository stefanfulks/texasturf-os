import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssistantChat } from "./chat";

export const metadata = { title: "Assistant · TexasTurf OS" };

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
        <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Ask anything about your tasks, invoices, inventory, vendors. I look
          things up in your live data — I don't make up answers.
        </p>
      </div>
      <AssistantChat greetingName={greetingName} />
    </div>
  );
}
