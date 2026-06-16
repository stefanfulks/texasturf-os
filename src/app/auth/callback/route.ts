import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { saveGoogleTokens } from "@/lib/google/tokens";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // After auth land on '/' — root now routes to /onboarding/department for
  // new users (departments empty) or /dashboard for everyone else.
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.session) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error?.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? "no_session")}`,
    );
  }

  // Internal app: only @texasturfusa.com Google accounts may sign in. The
  // OAuth flow itself accepts any Google account, so enforce the workspace
  // here — sign out + remove the just-created account for anyone else.
  const userEmail = data.session.user.email?.toLowerCase() ?? "";
  if (!userEmail.endsWith("@texasturfusa.com")) {
    await supabase.auth.signOut();
    try {
      await createServiceClient().auth.admin.deleteUser(data.session.user.id);
    } catch (e) {
      console.error("[auth/callback] failed to remove non-workspace user:", e);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Only @texasturfusa.com accounts can sign in.")}`,
    );
  }

  // Capture Google provider tokens. Supabase only includes them on this
  // single response — never on later getSession() calls. We persist them
  // to profiles so /calendar (and any other Google API caller) can use
  // them on subsequent requests, refreshing via the refresh_token when
  // the access token expires.
  const session = data.session;
  const providerToken        = session.provider_token        ?? null;
  const providerRefreshToken = session.provider_refresh_token ?? null;
  if (providerToken && session.user) {
    try {
      await saveGoogleTokens(
        session.user.id,
        providerToken,
        providerRefreshToken,
        // Google access tokens last 3600s; Supabase doesn't surface the
        // exact expiry separately, so default to one hour minus the
        // safety margin baked into saveGoogleTokens.
        3600,
      );
    } catch (e) {
      // Don't block the login if persistence fails — calendar will just
      // show its empty state and prompt re-sign-in.
      console.error("[auth/callback] saveGoogleTokens failed:", e);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
