import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLinks } from "@/components/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { AppSwitcher } from "@/components/app-switcher";

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

  // Count unread notifications for the bell badge
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="flex h-14 w-full items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <AppSwitcher />
            <NavLinks />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-sm flex-shrink-0">
            <NotificationBell initialUnread={unreadCount ?? 0} />
            <span className="hidden md:inline text-zinc-500 truncate max-w-[180px]">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </div>
    </div>
  );
}
