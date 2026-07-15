import { redirect } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RECORD_ANNOUNCEMENT_KEY } from "@/lib/calls/settings";
import { setRecordAnnouncement } from "./actions";

export const metadata = { title: "Settings · Calling · TexasTurf OS" };
export const dynamic = "force-dynamic";

/**
 * Calling settings (calling suite Phase 2). One toggle for now: the
 * "this call may be recorded" whisper played to the customer before the
 * bridge connects. Texas is one-party consent — the announcement is for
 * out-of-state callees, so it defaults ON. Admin-gated (RLS enforces too).
 */
export default async function CallingSettingsPage() {
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
  const isAdmin = profile?.role === "admin";

  const { data: setting } = await supabase
    .from("call_settings")
    .select("value, description")
    .eq("key", RECORD_ANNOUNCEMENT_KEY)
    .maybeSingle();
  const announceOn = setting?.value !== false;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-4 sm:py-6">
      <div>
        <p className="eyebrow mb-1 flex items-center gap-1.5">
          <PhoneCall className="h-3.5 w-3.5" aria-hidden />
          Settings · Calling
        </p>
        <h1 className="page-title">Calling</h1>
        <p className="mt-1 text-sm text-ink-2">
          Every dialer and deal-page call is recorded and AI-reviewed. These
          settings control the recording posture.
        </p>
      </div>

      <div className="panel p-5">
        <form action={setRecordAnnouncement} className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">Recording announcement</p>
            <p className="mt-1 max-w-md text-sm text-ink-2">
              Plays &ldquo;this call may be recorded&rdquo; to the customer
              before connecting. Texas is one-party consent, but keep this ON
              if you call out-of-state numbers.
            </p>
            <p className="mt-2 text-xs text-ink-3">
              Currently: <span className="font-semibold">{announceOn ? "ON" : "OFF"}</span>
            </p>
          </div>
          <input type="hidden" name="enabled" value={announceOn ? "false" : "true"} />
          <button type="submit" className="btn" disabled={!isAdmin}>
            {announceOn ? "Turn off" : "Turn on"}
          </button>
        </form>
        {!isAdmin && (
          <p className="mt-3 text-xs text-ink-3">Only admins can change this.</p>
        )}
      </div>
    </div>
  );
}
