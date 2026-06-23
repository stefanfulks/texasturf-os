import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssetLibrary, type AssetItem } from "./asset-library";

export const dynamic = "force-dynamic";

/** Admin media library for the pitch deck — curated photos + the testimonial video. */
export default async function PitchAssetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") notFound();

  const { data: objects } = await supabase.storage
    .from("pitch-assets")
    .list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });

  const initial: AssetItem[] = (objects ?? [])
    .filter((o) => o.id) // skip folder placeholders
    .map((o) => ({
      path: o.name,
      name: o.name.replace(/^\d+-/, ""),
      url: supabase.storage.from("pitch-assets").getPublicUrl(o.name).data.publicUrl,
      isVideo: /\.mp4$/i.test(o.name),
    }));

  return <AssetLibrary initial={initial} />;
}
