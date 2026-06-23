export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row); }
  return rows;
}

function headerIndex(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { idx[h.trim().toLowerCase()] = i; });
  return idx;
}

export function parsePnlCsv(text: string): { accountId: string; month: number; budget: number; actual: number }[] {
  const [header, ...rest] = parseCsv(text);
  const h = headerIndex(header);
  return rest.map((r) => ({
    accountId: r[h["account_id"]],
    month: Number(r[h["month"]]),
    budget: Number(r[h["budget"]] ?? 0),
    actual: Number(r[h["actual"]] ?? 0),
  }));
}

export function parseArCsv(text: string): { customer: string; invoiceNum: string; invoiceDate: string; openBalance: number; expectedReceiptDate: string }[] {
  const [header, ...rest] = parseCsv(text);
  const h = headerIndex(header);
  return rest.map((r) => ({
    customer: r[h["customer"]],
    invoiceNum: r[h["invoice_num"]] ?? "",
    invoiceDate: r[h["invoice_date"]] ?? "",
    openBalance: Number(r[h["open_balance"]] ?? 0),
    expectedReceiptDate: r[h["expected_receipt_date"]] ?? "",
  }));
}

export function parseApCsv(text: string): { vendor: string; billNum: string; invoiceDate: string; openBalance: number; expectedPayDate: string; paymentType: "cash" | "credit" }[] {
  const [header, ...rest] = parseCsv(text);
  const h = headerIndex(header);
  return rest.map((r) => ({
    vendor: r[h["vendor"]],
    billNum: r[h["bill_num"]] ?? "",
    invoiceDate: r[h["invoice_date"]] ?? "",
    openBalance: Number(r[h["open_balance"]] ?? 0),
    expectedPayDate: r[h["expected_pay_date"]] ?? "",
    paymentType: (r[h["payment_type"]] ?? "cash").toLowerCase() === "credit" ? "credit" : "cash",
  }));
}

export function toMatrix(headers: string[], rows: Record<string, unknown>[]): unknown[][] {
  return [headers, ...rows.map((r) => headers.map((hkey) => r[hkey]))];
}
