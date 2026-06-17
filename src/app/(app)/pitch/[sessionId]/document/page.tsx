import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signPitchPhotoPaths } from "@/lib/pitch-photos";
import { DocumentForm } from "./document-form";
import type { PitchArea, PitchSiteDoc } from "@/lib/db-helpers.types";

export default async function DocumentPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: session } = await supabase
    .from("pitch_sessions")
    .select("id, prospect_name, address, status")
    .eq("id", sessionId)
    .single();
  if (!session) notFound();

  const [{ data: areas }, { data: siteDoc }, { data: photos }] = await Promise.all([
    supabase.from("pitch_areas").select("*").eq("session_id", sessionId).order("sort", { ascending: true }),
    supabase.from("pitch_site_docs").select("*").eq("session_id", sessionId).maybeSingle(),
    supabase.from("pitch_photos").select("*").eq("session_id", sessionId).order("sort", { ascending: true }),
  ]);

  const signed = await signPitchPhotoPaths(supabase, (photos ?? []).map((p) => p.path));
  const photoItems = (photos ?? []).map((p) => ({
    id: p.id,
    areaId: p.area_id,
    category: p.category,
    path: p.path,
    name: p.name ?? "photo",
    url: signed.get(p.path) ?? "",
  }));

  return (
    <DocumentForm
      userId={user.id}
      session={{ id: session.id, prospectName: session.prospect_name, address: session.address, status: session.status }}
      areas={(areas ?? []) as PitchArea[]}
      siteDoc={(siteDoc ?? null) as PitchSiteDoc | null}
      photos={photoItems}
    />
  );
}
