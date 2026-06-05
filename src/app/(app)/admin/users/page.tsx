import { redirect } from "next/navigation";

// User management moved from /admin/users to /team. Keep a redirect for
// any old links / bookmarks.
export default function LegacyAdminUsersRedirect() {
  redirect("/team");
}
