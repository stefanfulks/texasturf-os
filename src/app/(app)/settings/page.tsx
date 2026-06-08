import Link from "next/link";
import { redirect } from "next/navigation";
import {
  User,
  Calendar as CalendarIcon,
  Users2,
  Bell,
  Plug,
  Briefcase,
  Truck,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings · TexasTurf OS" };

export default async function SettingsHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">Settings</h1>
        <p className="text-sm sm:text-base text-zinc-600 mt-1">
          Tune your account, manage shared tools, and connect integrations.
        </p>
      </div>

      {/* Personal — visible to everyone */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">
          You
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SettingTile
            href="/settings/account"
            icon={<User className="h-4 w-4" />}
            title="Account"
            description="Name, email, role, department"
            value={profile?.full_name ?? profile?.email ?? ""}
          />
          <SettingTile
            href="/settings/notifications"
            icon={<Bell className="h-4 w-4" />}
            title="Notifications"
            description="What gets a ping, what stays quiet"
            value="Coming soon"
            comingSoon
          />
        </div>
      </section>

      {/* Shared tools — admin can edit, everyone can see */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">
          Shared tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SettingTile
            href="/settings/meetings"
            icon={<Users2 className="h-4 w-4" />}
            title="Meetings"
            description={isAdmin ? "Create, edit, archive meeting templates" : "Browse meeting templates & schedule"}
          />
          <SettingTile
            href="/settings/calendar"
            icon={<CalendarIcon className="h-4 w-4" />}
            title="Calendar"
            description="Shared Google Calendar settings"
          />
          <SettingTile
            href="/settings/vehicles"
            icon={<Truck className="h-4 w-4" />}
            title="Vehicles"
            description="Fleet & reservation rules"
          />
          <SettingTile
            href="/settings/jobs"
            icon={<Briefcase className="h-4 w-4" />}
            title="Jobs"
            description="Job statuses, types, defaults"
            comingSoon
          />
        </div>
      </section>

      {/* Integrations — admin-only edit, but the page lists what's connected */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">
          Integrations
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SettingTile
            href="/settings/jobber"
            icon={<Plug className="h-4 w-4" />}
            title="Jobber"
            description="OAuth, sync, webhooks"
          />
          <SettingTile
            href="/settings/integrations"
            icon={<Plug className="h-4 w-4" />}
            title="Other integrations"
            description="Slack, Monday, Notion, Resend"
            comingSoon
          />
        </div>
      </section>

      {isAdmin && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">
            Admin
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SettingTile
              href="/team"
              icon={<Users2 className="h-4 w-4" />}
              title="Team"
              description="Invite, change roles, departments"
            />
          </div>
        </section>
      )}
    </div>
  );
}

function SettingTile({
  href,
  icon,
  title,
  description,
  value,
  comingSoon,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  value?: string;
  comingSoon?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-zinc-900">{title}</p>
            {comingSoon && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                soon
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
          {value && (
            <p className="text-xs text-zinc-700 mt-1 font-medium truncate">{value}</p>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
    </>
  );

  if (comingSoon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 opacity-60 cursor-not-allowed">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:shadow-sm transition-all"
    >
      {inner}
    </Link>
  );
}
