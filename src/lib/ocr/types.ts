export type OcrLineItem = {
  description: string;
  category?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  line_total: number;
  confidence?: number;
};

export type OcrResult = {
  vendor_name?: string;
  invoice_number?: string;
  invoice_date?: string;         // ISO date string
  service_period_start?: string;
  service_period_end?: string;
  due_date?: string;
  subtotal?: number;
  tax?: number;
  total_amount?: number;
  line_items: OcrLineItem[];
  raw_text: string;
  confidence: number;            // 0–100
  low_confidence_fields: string[];
  provider: string;
};
