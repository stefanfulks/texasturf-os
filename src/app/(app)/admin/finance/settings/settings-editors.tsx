"use client";
import { useState, useTransition } from "react";
import { upsertFinRow } from "./actions";

export type FieldDef = { key: string; label: string; type: "text" | "number" };

export function FinTableEditor({ table, fields, rows }: {
  table: Parameters<typeof upsertFinRow>[0];
  fields: FieldDef[];
  rows: Record<string, unknown>[];
}) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  function save(row: Record<string, unknown>) {
    start(() => { void upsertFinRow(table, row); });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-3 text-left">
            {fields.map((f) => <th key={f.key} className="px-2 py-1">{f.label}</th>)}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {fields.map((f) => (
                <td key={f.key} className="px-2 py-1">
                  <input
                    className="w-full bg-tint rounded px-1.5 py-0.5"
                    defaultValue={String(r[f.key] ?? "")}
                    type={f.type === "number" ? "number" : "text"}
                    onBlur={(e) => {
                      const v = f.type === "number" ? Number(e.target.value) : e.target.value;
                      if (v !== r[f.key]) save({ ...r, [f.key]: v });
                    }}
                  />
                </td>
              ))}
              <td className="px-2 py-1 text-ink-4 text-xs">{pending ? "saving…" : ""}</td>
            </tr>
          ))}
          <tr className="border-t border-line bg-hover/40">
            {fields.map((f) => (
              <td key={f.key} className="px-2 py-1">
                <input
                  className="w-full bg-white rounded px-1.5 py-0.5"
                  placeholder={f.label}
                  type={f.type === "number" ? "number" : "text"}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                />
              </td>
            ))}
            <td className="px-2 py-1">
              <button className="text-brand" onClick={() => save(draft)} disabled={pending}>Add</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
