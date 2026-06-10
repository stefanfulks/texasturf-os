import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/marketing/csv";

// GET /marketing/referrals/export?campaign=<uuid>
// Downloads the queued + retryable roster rows as a Reevo-importable CSV.
export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaign");
  if (!campaignId) return new Response("Missing ?campaign=<id>", { status: 400 });

  const { data: rows, error } = await supabase
    .from("referral_outreach")
    .select("client_name, client_phone, client_email, last_job_note, segment, call_status")
    .eq("campaign_id", campaignId)
    .in("call_status", ["queued", "no_answer"])
    .order("created_at", { ascending: true });
  if (error) return new Response(`Query failed: ${error.message}`, { status: 500 });

  const csv = toCsv(
    ["first_name", "last_name", "phone", "email", "note", "segment"],
    (rows ?? []).map((r) => {
      const parts = r.client_name.trim().split(/\s+/);
      const first = parts.slice(0, -1).join(" ") || parts[0] || "";
      const last = parts.length > 1 ? parts[parts.length - 1] : "";
      return [first, last, r.client_phone, r.client_email, r.last_job_note, r.segment];
    }),
  );

  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reevo-call-list-${today}.csv"`,
    },
  });
}
