"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { createToolPurchase } from "@/lib/warehouse/actions";

type AssetOpt = { id: string; name: string; unit_type: string };
type EmployeeOpt = { id: string; display_name: string };

const field =
  "field-input";
const label = "field-label";

export function NewToolPurchaseForm({
  assets,
  employees,
}: {
  assets: AssetOpt[];
  employees: EmployeeOpt[];
}) {
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
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

  const today = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  async function onReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setReceiptError(null);
    setReceiptUploading(true);
    try {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `purchases/temp/${crypto.randomUUID()}-${safe}`;
      const { data, error } = await supabase.storage
        .from("warehouse")
        .upload(path, f, { cacheControl: "3600", upsert: false });
      if (error) {
        setReceiptError(error.message);
        setReceiptUploading(false);
        return;
      }
      // 1 year signed URL — receipts may be needed for taxes / warranty.
      const { data: signed, error: signErr } = await supabase.storage
        .from("warehouse")
        .createSignedUrl(data.path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) {
        setReceiptError(signErr?.message ?? "Could not sign URL");
        setReceiptUploading(false);
        return;
      }
      setReceiptUrl(signed.signedUrl);
    } finally {
      setReceiptUploading(false);
    }
  }

  function clearReceipt() {
    setReceiptUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(formData: FormData) {
    setSubmitError(null);
    startTransition(async () => {
      try {
        await createToolPurchase(formData);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("NEXT_REDIRECT")) return;
        setSubmitError(msg);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <Section title="Item">
        <div>
          <label className={label}>Item name *</label>
          <input
            name="item_name"
            required
            placeholder="e.g. DeWalt 20V drill"
            className={field}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Category *</label>
            <select name="category" defaultValue="tool" required className={field}>
              <option value="tool">Tool</option>
              <option value="small_equipment">Small equipment</option>
              <option value="supply">Supply</option>
            </select>
          </div>
          <div>
            <label className={label}>For vehicle / equipment (optional)</label>
            <select name="asset_id" defaultValue="" className={field}>
              <option value="">— none —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.unit_type.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Purchase">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Purchase date *</label>
            <input
              type="date"
              name="purchase_date"
              required
              defaultValue={today}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Vendor</label>
            <input name="vendor" placeholder="e.g. Home Depot" className={field} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>Quantity</label>
            <input
              type="number" inputMode="decimal"
              min="1"
              step="1"
              name="quantity"
              defaultValue={1}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Cost per item (USD)</label>
            <input
              type="number" inputMode="decimal"
              min="0"
              step="0.01"
              name="cost"
              placeholder="0.00"
              className={field}
            />
          </div>
          <div>
            <label className={label}>Crew (optional)</label>
            <input name="crew" placeholder="e.g. Crew 2" className={field} />
          </div>
        </div>
      </Section>

      <Section title="Receipt (optional)">
        {receiptUrl && <input type="hidden" name="receipt_url" value={receiptUrl} />}
        {receiptUrl ? (
          <div className="space-y-2">
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ink-2 underline-offset-2 hover:underline"
            >
              Receipt uploaded ↗
            </a>
            <div>
              <button
                type="button"
                onClick={clearReceipt}
                className="text-xs text-ink-3 hover:text-ink"
              >
                Replace
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={onReceiptChange}
              disabled={receiptUploading}
              className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white file:cursor-pointer hover:file:bg-brand"
            />
            <p className="text-xs text-ink-3">
              {receiptUploading ? "Uploading…" : "Image or PDF. Stored in the warehouse bucket."}
            </p>
            {receiptError && (
              <p className="text-xs text-danger">{receiptError}</p>
            )}
          </div>
        )}
      </Section>

      <Section title="Attribution (optional)">
        <div>
          <label className={label}>Submitted by (employee)</label>
          <select name="submitted_by_employee_id" defaultValue="" className={field}>
            <option value="">— current OS user —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.display_name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-3">
            If left blank we attribute to the signed-in OS user.
          </p>
        </div>
      </Section>

      {submitError && (
        <p className="rounded-lg border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Link href="/operations/tools" className="px-4 py-2 text-sm text-ink-2 hover:text-ink">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending || receiptUploading}
          className="btn btn-primary disabled:opacity-50"
        >
          {isPending ? "Logging…" : "Log purchase"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 space-y-3">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
