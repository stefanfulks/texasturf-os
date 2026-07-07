import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ExternalLink, Calendar as CalendarIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getValidGoogleAccessToken } from "@/lib/google/tokens";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar · Settings · TexasTurf OS" };

export default async function CalendarSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tokenStatus = await getValidGoogleAccessToken(user.id);
  const googleConnected = tokenStatus.ok;
  const embedSrc = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_SRC ?? null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-5">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-ink-3 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" />
        Settings
      </Link>

      <div>
        <h1 className="page-title">Calendar</h1>
        <p className="text-sm sm:text-base text-ink-2 mt-1">
          Personal Google Calendar + the shared TexasTurf calendar shown on the Calendar page.
        </p>
      </div>

      {/* Personal connection */}
      <section className="rounded-2xl border border-line bg-white p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-info-tint text-info flex items-center justify-center">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-ink">Personal Google Calendar</h2>
            {googleConnected ? (
              <p className="text-xs text-brand mt-0.5">
                <span className="font-medium">Connected.</span> Your upcoming events show on the Calendar page.
              </p>
            ) : (
              <p className="text-xs text-ink-3 mt-0.5">
                {tokenStatus.reason === "no_tokens"
                  ? "Sign out and sign back in with Google to connect your personal calendar."
                  : `Token issue: ${tokenStatus.reason}. Sign out / sign back in to reset.`}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Shared calendar embed */}
      <section className="rounded-2xl border border-line bg-white p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Shared TexasTurf calendar</h2>
          <p className="text-xs text-ink-3 mt-0.5">
            The team-wide calendar embedded on the Calendar page.
          </p>
        </div>
        {embedSrc ? (
          <div className="rounded-xl border border-line bg-hover p-3">
            <p className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1">Embed source</p>
            <p className="text-xs font-mono text-ink break-all">{embedSrc}</p>
            <a
              href={`https://calendar.google.com/calendar/u/0?cid=${encodeURIComponent(embedSrc)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-info hover:underline"
            >
              Open in Google Calendar
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <div className="rounded-xl border border-warn/30 bg-warn-tint p-3 text-xs text-warn space-y-1">
            <p className="font-medium">No shared calendar configured.</p>
            <p>
              Set <code className="font-mono bg-warn-tint px-1 py-0.5 rounded text-[10px]">NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_SRC</code> in
              Vercel to the Google Calendar ID (e.g. <code className="font-mono">team@texasturfusa.com</code>).
              Make sure the calendar is shared with the org.
            </p>
          </div>
        )}
        <p className="text-[11px] text-ink-3">
          Source lives in the Vercel environment — changing it requires a redeploy. Edit at{" "}
          <a
            href="https://vercel.com/stefanfulks-projects/texasturf-os/settings/environment-variables"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-ink-2 hover:text-ink"
          >
            Vercel env vars
          </a>.
        </p>
      </section>

      {/* Quick links */}
      <section className="rounded-2xl border border-dashed border-line bg-hover p-4 text-xs text-ink-2 space-y-1.5">
        <p className="font-medium text-ink-2">Related</p>
        <Link href="/calendar" className="block underline hover:text-ink">/calendar — the main calendar page</Link>
        <Link href="/calendar/new" className="block underline hover:text-ink">/calendar/new — create a new event</Link>
      </section>
    </div>
  );
}
