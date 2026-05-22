import type { OcrResult } from "./types";

const SAMPLE_LINE_ITEMS = [
  [
    { description: "Turf installation labor", category: "labor", quantity: 1, unit: "job", unit_price: 2800, line_total: 2800, confidence: 92 },
    { description: "Synthetic turf material (850 sq ft)", category: "material", quantity: 850, unit: "sq ft", unit_price: 4.50, line_total: 3825, confidence: 88 },
    { description: "Base prep and compaction", category: "labor", quantity: 1, unit: "job", unit_price: 600, line_total: 600, confidence: 85 },
  ],
  [
    { description: "Demo and removal", category: "demo", quantity: 1, unit: "job", unit_price: 450, line_total: 450, confidence: 90 },
    { description: "Binder infill (50 lbs)", category: "material", quantity: 50, unit: "lbs", unit_price: 1.20, line_total: 60, confidence: 78 },
    { description: "Delivery fee", category: "delivery", quantity: 1, unit: "flat", unit_price: 175, line_total: 175, confidence: 95 },
    { description: "Installation labor", category: "labor", quantity: 1200, unit: "sq ft", unit_price: 2.25, line_total: 2700, confidence: 88 },
  ],
  [
    { description: "Dump fee", category: "dump_fee", quantity: 1, unit: "load", unit_price: 225, line_total: 225, confidence: 82 },
    { description: "Equipment rental", category: "equipment", quantity: 2, unit: "day", unit_price: 350, line_total: 700, confidence: 79 },
    { description: "Labor – install crew", category: "labor", quantity: 8, unit: "hr", unit_price: 65, line_total: 520, confidence: 91 },
  ],
];

/** Simulate realistic OCR extraction from an invoice image */
export async function runMockOcr(
  fileUrl: string,
  vendorName?: string,
  manualTotal?: number,
): Promise<OcrResult> {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  const lineItems = SAMPLE_LINE_ITEMS[Math.floor(Math.random() * SAMPLE_LINE_ITEMS.length)];
  const subtotal  = lineItems.reduce((sum, item) => sum + item.line_total, 0);
  const tax       = 0; // turf installs typically not taxed
  const total     = manualTotal ?? subtotal;
  const confidence = 82 + Math.random() * 15;  // 82–97

  const now         = new Date();
  const startDate   = new Date(now);
  startDate.setDate(now.getDate() - 7);
  const endDate     = new Date(now);
  endDate.setDate(now.getDate() - 2);

  const invoiceNum  = `INV-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    vendor_name:          vendorName ?? "Unknown Vendor",
    invoice_number:       invoiceNum,
    invoice_date:         startDate.toISOString().slice(0, 10),
    service_period_start: startDate.toISOString().slice(0, 10),
    service_period_end:   endDate.toISOString().slice(0, 10),
    subtotal,
    tax,
    total_amount:         total,
    line_items:           lineItems,
    raw_text:             `INVOICE ${invoiceNum}\n${vendorName ?? "Vendor"}\n\n${lineItems.map((l) => `${l.description}  ${l.line_total.toFixed(2)}`).join("\n")}\n\nTOTAL: $${total.toFixed(2)}`,
    confidence:           Math.round(confidence * 10) / 10,
    low_confidence_fields: confidence < 88 ? ["service_period_end", "tax"] : [],
    provider:             "mock",
  };
}
