import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/user-menu";
import { NavLinks } from "@/components/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { TurfyLauncher } from "@/components/turfy-launcher";
import { CommandPalette, SearchButton } from "@/components/command-palette";
import { AnalyticsIdentify } from "@/components/analytics-identify";
import { PostHogProvider } from "@/components/posthog-provider";
import { parseDepartments } from "@/lib/departments";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Profile drives the UserMenu (name + role), the admin-only nav surfaces,
  // and the department-aware tab ordering (field crew sees Today first,
  // office sees Invoices, warehouse sees Operations…).
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, departments")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";
  const userDepartments = parseDepartments(
    (profile as { departments?: unknown } | null)?.departments,
  );
  const primaryDepartment = userDepartments[0] ?? null;

  // Count unread notifications for the bell badge.
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);

  // Open feedback awaiting triage — drives the count badge on the admin
  // Feedback nav tab. Only admins triage, so only they need the number.
  let feedbackOpen = 0;
  if (isAdmin) {
    const { count } = await supabase
      .from("app_feedback")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "in_progress"])
      .is("deleted_at", null);
    feedbackOpen = count ?? 0;
  }

  // First name (or email handle) for Turfy's empty-state greeting. Matches
  // the derivation used by /assistant/page.tsx.
  const greetingName =
    profile?.full_name?.split(" ")[0] ??
    profile?.email?.split("@")[0] ??
    user.email?.split("@")[0] ??
    "there";

  return (
    <Suspense>
    <PostHogProvider>
    <div className="flex flex-1 flex-col">
      <AnalyticsIdentify
        userId={user.id}
        email={profile?.email ?? user.email ?? ""}
        role={profile?.role ?? null}
      />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-md supports-[backdrop-filter]:bg-surface/65">
        <div className="flex h-14 w-full items-center justify-between gap-4 px-4 sm:px-6">
          {/* LEFT — identity + nav */}
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <UserMenu
              fullName={profile?.full_name ?? null}
              email={profile?.email ?? user.email ?? ""}
              role={profile?.role ?? null}
              isAdmin={isAdmin}
            />
            <span className="hidden sm:block h-5 w-px bg-line" aria-hidden />
            <NavLinks isAdmin={isAdmin} department={primaryDepartment} feedbackCount={feedbackOpen} />
          </div>

          {/* RIGHT — search + notifications + settings gear */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <SearchButton />
            <NotificationBell initialUnread={unreadCount ?? 0} />
            <Link
              href="/settings"
              aria-label="Settings"
              title="Settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-ink-3 hover:text-ink hover:bg-hover active:bg-sunken transition-colors"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
          </div>
        </div>
      </header>
      <div className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-9">
        {children}
      </div>
      <TurfyLauncher greetingName={greetingName} />
      <CommandPalette />
    </div>
    </PostHogProvider>
    </Suspense>
  );
}
