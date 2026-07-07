"use client";
import { useState } from "react";
import { parseArCsv, parseApCsv } from "@/lib/finance/io";
import { importAr, importAp } from "./actions";

export default function ImportPage() {
  const [type, setType] = useState<"ar" | "ap">("ar");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const preview = text.trim() ? (type === "ar" ? parseArCsv(text) : parseApCsv(text)) : [];

  async function confirm() {
    const res = type === "ar" ? await importAr(text) : await importAp(text);
    setMsg(`Imported ${res.inserted} ${type.toUpperCase()} rows.`);
    setText("");
  }

  return (
    <div className="space-y-4">
      <h1 className="page-title">Import</h1>
      <div className="flex gap-2 text-sm">
        {(["ar", "ap"] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className={"rounded-lg px-3 py-1.5 " + (type === t ? "bg-brand text-white" : "bg-tint text-ink-2")}>{t === "ar" ? "AR (receivables)" : "AP (payables)"}</button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
        placeholder={type === "ar" ? "customer,invoice_num,invoice_date,open_balance,expected_receipt_date" : "vendor,bill_num,invoice_date,open_balance,expected_pay_date,payment_type"}
        className="w-full bg-tint rounded-lg p-3 font-mono text-xs" />
      {preview.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-3 text-sm">
          <p className="text-ink-3 mb-2">Preview — {preview.length} rows (review before importing):</p>
          <pre className="overflow-x-auto text-xs">{JSON.stringify(preview.slice(0, 5), null, 2)}</pre>
          <button onClick={confirm} className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-white">Confirm import {preview.length} rows</button>
        </div>
      )}
      {msg && <p className="text-success text-sm">{msg}</p>}
    </div>
  );
}
