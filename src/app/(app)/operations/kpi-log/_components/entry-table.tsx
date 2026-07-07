import { SECTION_FIELDS } from "./fields";
import { SignOffButton } from "./signoff-button";
import type { KpiEntry } from "@/lib/kpi-log/queries";
import type { SectionId } from "@/lib/kpi-log/schemas";

export function EntryTable({
  section,
  entries,
  signerNames,
  isAdmin,
}: {
  section: SectionId;
  entries: KpiEntry[];
  signerNames: Map<string, string>;
  isAdmin: boolean;
}) {
  const fields = SECTION_FIELDS[section];

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center">
        <p className="text-sm font-medium text-ink-2">No entries yet.</p>
        <p className="mt-1 text-xs text-ink-3">Add the first one above.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-hover">
            <th className="text-left px-4 py-3 font-semibold text-ink-2 whitespace-nowrap">Date</th>
            {fields.map((f) => (
              <th key={f.name} className="text-left px-4 py-3 font-semibold text-ink-2 whitespace-nowrap">
                {f.label}
              </th>
            ))}
            <th className="text-left px-4 py-3 font-semibold text-ink-2">Notes</th>
            <th className="text-right px-4 py-3 font-semibold text-ink-2 whitespace-nowrap">Sign-off</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {entries.map((e) => {
            const payload = (e.payload ?? {}) as Record<string, unknown>;
            return (
              <tr key={e.id} className="align-top">
                <td className="px-4 py-3 whitespace-nowrap text-ink-2">{formatDate(e.entry_date)}</td>
                {fields.map((f) => (
                  <td key={f.name} className="px-4 py-3 text-ink-2">
                    {formatValue(f.type, payload[f.name])}
                  </td>
                ))}
                <td className="px-4 py-3 text-ink-3 max-w-xs whitespace-pre-wrap">{e.notes ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {isAdmin ? (
                    <SignOffButton
                      entryId={e.id}
                      signed={!!e.mgmt_signed_by}
                      signerName={e.mgmt_signed_by ? signerNames.get(e.mgmt_signed_by) ?? null : null}
                      signedAt={e.mgmt_signed_at}
                      mgmtNotes={e.mgmt_notes}
                    />
                  ) : (
                    <SignedBadge entry={e} signerName={e.mgmt_signed_by ? signerNames.get(e.mgmt_signed_by) ?? null : null} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SignedBadge({ entry, signerName }: { entry: KpiEntry; signerName: string | null }) {
  if (entry.mgmt_signed_by) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand">
          ✓ Signed
        </span>
        {signerName && <span className="text-[10px] text-ink-4">{signerName}</span>}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warn-tint px-2 py-0.5 text-[11px] font-medium text-warn">
      ⏳ Pending
    </span>
  );
}

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString();
}

function formatValue(type: string, v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (type === "yn") return v === "Y" ? "Yes" : v === "N" ? "No" : String(v);
  if (type === "passfail") return v === "pass" ? "Pass" : v === "fail" ? "Fail" : String(v);
  if (type === "number") return String(v);
  return String(v);
}
