import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { contentGroups, CONTENT_BY_KEY } from "@/lib/content/registry";
import { ContentEditor } from "./content-editor";

export const metadata = { title: "Content · TexasTurf OS" };

// Which page each editor group links to (so admins can jump to see their edits).
const GROUP_PREVIEW: Record<string, string> = {
  "Marketing · Organic Growth": "/marketing/playbook",
};

export default async function ContentAdminPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: overrides } = await supabase.from("content_blocks").select("key, value");
  const overrideMap = new Map<string, string>((overrides ?? []).map((r) => [r.key, r.value]));

  const initial: Record<string, { value: string; isOverride: boolean }> = {};
  for (const [key, block] of CONTENT_BY_KEY) {
    const has = overrideMap.has(key);
    initial[key] = { value: has ? overrideMap.get(key)! : block.default, isOverride: has };
  }

  const groups = contentGroups().map((g) => ({ ...g, previewHref: GROUP_PREVIEW[g.group] }));
  const editedCount = Object.values(initial).filter((s) => s.isOverride).length;

  return (
    <div className="max-w-4xl space-y-6">
      <header className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Admin</p>
          <h1 className="page-title">Content</h1>
          <p className="page-sub">
            Edit the copy across the app without a deploy. Changes save instantly and
            fall back to the built-in default until you edit them.
          </p>
        </div>
        <span className="chip chip-neutral">
          <FileText className="h-3.5 w-3.5" />
          {CONTENT_BY_KEY.size} blocks · {editedCount} edited
        </span>
      </header>

      <ContentEditor groups={groups} initial={initial} />
    </div>
  );
}
