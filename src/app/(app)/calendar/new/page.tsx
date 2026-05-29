import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "./event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  const isGoogleUser = session?.user?.app_metadata?.provider === "google";

  if (!isGoogleUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Link href="/calendar" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Calendar
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900">New event</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Creating events requires a Google sign-in. Sign out and sign back in with Google to enable this.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link href="/calendar" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Calendar
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">New event</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Creates an event on your primary Google Calendar.
        </p>
      </div>
      <EventForm />
    </div>
  );
}
