import { describe, it, expect } from "vitest";
import { parseCsv, parsePnlCsv, parseArCsv, toMatrix } from "@/lib/finance/io";

describe("parseCsv", () => {
  it("parses rows and handles quoted fields with commas", () => {
    const rows = parseCsv('a,b,c\n1,"hello, world",3\n');
    expect(rows).toEqual([["a", "b", "c"], ["1", "hello, world", "3"]]);
  });
});

describe("parsePnlCsv", () => {
  it("maps header columns to account/month/budget/actual", () => {
    const csv = "account_id,month,budget,actual\nrevenue,1,100000,90000\ncogs_materials,1,30000,28000\n";
    const rows = parsePnlCsv(csv);
    expect(rows[0]).toEqual({ accountId: "revenue", month: 1, budget: 100000, actual: 90000 });
    expect(rows[1].accountId).toBe("cogs_materials");
  });
});

describe("parseArCsv", () => {
  it("maps an AR aging row", () => {
    const csv = "customer,invoice_num,invoice_date,open_balance,expected_receipt_date\nAcme,INV-1,2026-06-01,5000,2026-06-20\n";
    const rows = parseArCsv(csv);
    expect(rows[0]).toEqual({ customer: "Acme", invoiceNum: "INV-1", invoiceDate: "2026-06-01", openBalance: 5000, expectedReceiptDate: "2026-06-20" });
  });
});

describe("toMatrix", () => {
  it("builds a header + rows matrix for export", () => {
    const m = toMatrix(["Name", "Amount"], [{ Name: "Rent", Amount: 1000 }]);
    expect(m).toEqual([["Name", "Amount"], ["Rent", 1000]]);
  });
});
