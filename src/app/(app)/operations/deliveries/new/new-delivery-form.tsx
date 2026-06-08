"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { createDelivery } from "@/lib/warehouse/actions";

type EmployeeOpt = { id: string; display_name: string };
type ClientOpt = { id: string; name: string };
type PullListOpt = {
  id: string;
  job_date: string;
  client_name: string | null;
  job_number: string | null;
  status: string;
};

const field =
  "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";
const label = "block text-xs font-medium text-zinc-500 mb-1";

export function NewDeliveryForm({
  employees,
  clients,
  pullLists,
  prefillPullListId,
}: {
  employees: EmployeeOpt[];
  clients: ClientOpt[];
  pullLists: PullListOpt[];
  prefillPullListId: string | null;
}) {
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // datetime-local needs "YYYY-MM-DDTHH:mm" in local time
  const nowLocal = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      // Path: deliveries/temp/{uuid}-{filename}. The action stores the URL;
      // the storage bucket key contains "temp/" because the delivery_id
      // doesn't exist yet at upload time. Tighten later if we want a move.
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `deliveries/temp/${crypto.randomUUID()}-${safe}`;
      const { data, error } = await supabase.storage
        .from("warehouse")
        .upload(path, f, { cacheControl: "3600", upsert: false });
      if (error) {
        setPhotoError(error.message);
        setPhotoUploading(false);
        return;
      }
      // 30-day signed URL — the Slack post embeds the image by URL, and the
      // detail page reads it. Long enough to outlast a job, short enough to
      // expire on its own.
      const { data: signed, error: signErr } = await supabase.storage
        .from("warehouse")
        .createSignedUrl(data.path, 60 * 60 * 24 * 30);
      if (signErr || !signed?.signedUrl) {
        setPhotoError(signErr?.message ?? "Could not sign URL");
        setPhotoUploading(false);
        return;
      }
      setPhotoUrl(signed.signedUrl);
    } finally {
      setPhotoUploading(false);
    }
  }

  function clearPhoto() {
    setPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(formData: FormData) {
    setSubmitError(null);
    startTransition(async () => {
      try {
        await createDelivery(formData);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("NEXT_REDIRECT")) return;
        setSubmitError(msg);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* ─── Linkage ───────────────────────────────────────────────────── */}
      <Section title="Linkage">
        <div>
          <label className={label}>Pull list (optional — auto-fills client + address)</label>
          <select
            name="pull_list_id"
            defaultValue={prefillPullListId ?? ""}
            className={field}
          >
            <option value="">— none —</option>
            {pullLists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.job_date} · {p.client_name ?? "(no client)"}
                {p.job_number ? ` · #${p.job_number}` : ""}
                {" · "}{p.status}
              </option>
            ))}
          </select>
        </div>
      </Section>

      {/* ─── Job site ──────────────────────────────────────────────────── */}
      <Section title="Job site">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Client (Jobber)</label>
            <select name="client_id" defaultValue="" className={field}>
              <option value="">— none —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Client name (override)</label>
            <input name="client_name" placeholder="Optional" className={field} />
          </div>
        </div>
        <div>
          <label className={label}>Address</label>
          <input name="address" placeholder="Street, City" className={field} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Delivered at</label>
            <input
              type="datetime-local"
              name="delivered_at"
              defaultValue={nowLocal}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Staged at</label>
            <input name="staging_location" placeholder="e.g. Side yard, north corner" className={field} />
          </div>
        </div>
      </Section>

      {/* ─── Receipt ───────────────────────────────────────────────────── */}
      <Section title="Receipt">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Received by (employee)</label>
            <select name="received_by_employee_id" defaultValue="" className={field}>
              <option value="">— pick someone —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Received by (free text)</label>
            <input name="received_by" placeholder="If not in list" className={field} />
          </div>
        </div>
      </Section>

      {/* ─── Materials ─────────────────────────────────────────────────── */}
      <Section title="Materials delivered">
        <p className="text-xs text-zinc-500">Leave a section blank if it doesn&apos;t apply.</p>

        <div>
          <h3 className="text-xs font-semibold text-zinc-600 mt-2">Turf</h3>
          <div className="mt-1 grid grid-cols-3 gap-3">
            <div>
              <label className={label}>Product</label>
              <input name="mat_turf_product" placeholder="e.g. ProPlay Plus" className={field} />
            </div>
            <div>
              <label className={label}>Sqft</label>
              <input type="number" min="0" step="0.01" name="mat_turf_sqft" className={field} />
            </div>
            <div>
              <label className={label}>Batch</label>
              <input name="mat_turf_batch" className={field} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-zinc-600 mt-2">DG (cubic yards)</h3>
          <input type="number" min="0" step="0.01" name="mat_dg_cubic_yards" className={field} />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-zinc-600 mt-2">Infill</h3>
          <div className="mt-1 grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Type</label>
              <input name="mat_infill_type" placeholder="e.g. Fine sand" className={field} />
            </div>
            <div>
              <label className={label}>Bags</label>
              <input type="number" min="0" name="mat_infill_bags" className={field} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-zinc-600 mt-2">Fasteners (boxes)</h3>
          <div className="mt-1 grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Nails</label>
              <input type="number" min="0" name="mat_nails_boxes" className={field} />
            </div>
            <div>
              <label className={label}>Staples</label>
              <input type="number" min="0" name="mat_staples_boxes" className={field} />
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Photo ─────────────────────────────────────────────────────── */}
      <Section title="Photo (optional)">
        {photoUrl && (
          <input type="hidden" name="photo_url" value={photoUrl} />
        )}
        {photoUrl ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Delivery preview" className="max-h-64 rounded-lg border border-zinc-200" />
            <button
              type="button"
              onClick={clearPhoto}
              className="text-xs text-zinc-500 hover:text-zinc-900"
            >
              Replace photo
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
              disabled={photoUploading}
              className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white file:cursor-pointer hover:file:bg-zinc-700"
            />
            <p className="text-xs text-zinc-500">
              {photoUploading ? "Uploading…" : "JPG / PNG / HEIC. Embedded in the Slack post."}
            </p>
            {photoError && (
              <p className="text-xs text-red-700">{photoError}</p>
            )}
          </div>
        )}
      </Section>

      {/* ─── Notes ─────────────────────────────────────────────────────── */}
      <Section title="Notes">
        <textarea name="notes" rows={3} placeholder="Anything the team should see…" className={`${field} resize-none`} />
      </Section>

      {submitError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <a
          href="/operations/deliveries"
          className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending || photoUploading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Log delivery + post to Slack"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}
