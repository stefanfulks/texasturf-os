import { redirect } from "next/navigation";

// The middleware sends unauthenticated users to /login and authenticated users
// to /fleet, so the root just normalizes whichever case slipped through.
export default function Home() {
  redirect("/fleet");
}
