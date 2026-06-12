import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CopyButton } from "../copy-button";
import { StatusControl, ChannelChecklist } from "./controls";

type CopyBlock = { label?: string; subject?: string; body?: string };

const DEFAULT_CHANNELS = [
  "Jobber email to client segment",
  "Troy long video",
  "Short cuts (4–6)",
  "Before/after photo set",
  "SEO blog post",
  "Social + yard-sign CTA swap",
];

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: c, error } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (error || !c) notFound();

  const copyBlocks: CopyBlock[] = Array.isArray(c.jobber_copy) ? (c.jobber_copy as unknown as CopyBlock[]) : [];
  type Channel = { channel: string; done_at: string | null };
  const storedChannels: Channel[] = Array.isArray(c.channels) ? (c.channels as unknown as Channel[]) : [];
  // Merge default checklist with any stored done-state.
  const checklist = DEFAULT_CHANNELS.map((label) => ({
    channel: label,
    done_at: storedChannels.find((s) => s.channel === label)?.done_at ?? null,
  }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/marketing/campaigns" className="text-xs text-ink-4 hover:underline">← Campaigns</Link>
        <div className="flex items-center justify-between flex-wrap gap-3 mt-1">
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          <StatusControl id={c.id} status={c.status} />
        </div>
        <p className="text-sm text-ink-3 mt-0.5">
          {c.type.replace(/_/g, " ")}{c.service_line ? ` · ${c.service_line.replace(/_/g, " ")}` : ""}{c.starts_on ? ` · starts ${c.starts_on}` : ""}
        </p>
      </div>

      {c.brief_md && (
        <section className="rounded-xl border border-line bg-white p-6">
          <h2 className="text-sm font-semibold mb-2">Brief</h2>
          <pre className="text-sm text-ink-2 whitespace-pre-wrap font-sans leading-relaxed">{c.brief_md}</pre>
        </section>
      )}

      <section className="rounded-xl border border-line bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold">Copy to paste into Jobber</h2>
        {copyBlocks.length === 0 ? (
          <p className="text-sm text-ink-4">No copy blocks on this campaign yet.</p>
        ) : (
          copyBlocks.map((b, idx) => (
            <div key={idx} className="rounded-lg border border-line bg-hover/60 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink-2">{b.label ?? `Block ${idx + 1}`}</span>
              </div>
              {b.subject ? (
                <div className="flex items-center justify-between gap-2 bg-white rounded border border-line px-3 py-2">
                  <span className="text-sm text-ink"><span className="text-ink-4">Subject: </span>{b.subject}</span>
                  <CopyButton text={b.subject} label="Copy subject" />
                </div>
              ) : null}
              {b.body ? (
                <div className="space-y-1.5">
                  <div className="flex justify-end"><CopyButton text={b.body} label="Copy body" /></div>
                  <p className="text-sm text-ink-2 whitespace-pre-wrap bg-white rounded border border-line px-3 py-2">{b.body}</p>
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-semibold mb-3">Channel checklist</h2>
        <ChannelChecklist id={c.id} items={checklist} />
      </section>
    </div>
  );
}
