import { redirect } from "next/navigation";

// Middleware sends unauthenticated users to /login. Any authenticated user who
// lands at / goes to their personal dashboard. From there they can choose a
// department (Sales / Warehouse / Office / Financial) or jump straight to a
// known tool.
export default function Home() {
  redirect("/dashboard");
}
