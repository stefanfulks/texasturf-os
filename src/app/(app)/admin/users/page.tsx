import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserRow } from "./user-row";
import { InviteUserForm } from "./invite-form";
import { parseDepartments } from "@/lib/departments";

export const metadata = { title: "User Management · TexasTurf OS" };

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: usersRaw } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department, departments")
    .order("full_name", { ascending: true, nullsFirst: false });

  const users = (usersRaw ?? []).map((u) => {
    const cast = u as unknown as {
      id: string;
      full_name: string | null;
      email: string;
      role: string;
      department: string | null;
      departments: unknown;
    };
    return {
      id:          cast.id,
      full_name:   cast.full_name,
      email:       cast.email,
      role:        cast.role,
      departments: parseDepartments(cast.departments).length > 0
        ? parseDepartments(cast.departments)
        : parseDepartments(cast.department ? [cast.department] : []),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          ← Dashboard
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Set each user&apos;s role and which departments they belong to.
              Role gates what they can DO (admin / office / field). Departments
              drive what they SEE on the dashboard.
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            {users.length} {users.length === 1 ? "user" : "users"}
          </span>
        </div>
      </div>

      <InviteUserForm />

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-zinc-500">
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Email</th>
                <th className="text-left px-4 py-3 font-semibold w-40">Role</th>
                <th className="text-left px-4 py-3 font-semibold">Departments</th>
                <th className="text-right px-4 py-3 font-semibold w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => (
                <UserRow key={u.id} user={u} currentUserId={user.id} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Tip: you can&apos;t demote yourself from admin — ask another admin to
        do it if needed.
      </p>
    </div>
  );
}
