import type { OcrResult } from "./types";

interface OpenAIExtracted {
  vendor_name?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  service_period_start?: string | null;
  service_period_end?: string | null;
  total_amount?: number | null;
  subtotal?: number | null;
  tax?: number | null;
  line_items?: Array<{
    description: string;
    quantity?: number | null;
    unit_price?: number | null;
    line_total: number;
  }> | null;
  notes?: string | null;
}

const SYSTEM_PROMPT =
  "You are an invoice data extraction assistant. Extract structured data from this invoice image and return ONLY valid JSON with no markdown formatting.";

const USER_PROMPT =
  "Extract all invoice data and return JSON with these exact keys: vendor_name (string|null), invoice_number (string|null), invoice_date (string|null, ISO format YYYY-MM-DD), service_period_start (string|null, ISO), service_period_end (string|null, ISO), total_amount (number|null), subtotal (number|null), tax (number|null), line_items (array of {description: string, quantity: number|null, unit_price: number|null, line_total: number}), notes (string|null). Return ONLY the JSON object.";

export async function runOcrOpenAI(
  fileUrl: string,
  fileType: string,
): Promise<OcrResult> {
  const isPdf = fileType.toLowerCase().includes("pdf");

  // Build the user message content — PDFs can't be sent as image_url
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } };

  const userContent: ContentBlock[] = isPdf
    ? [
        {
          type: "text",
          text: `The following is a URL to a PDF invoice. Please extract the invoice data from it and return the JSON as instructed.\nURL: ${fileUrl}\n\n${USER_PROMPT}`,
        },
      ]
    : [
        { type: "image_url", image_url: { url: fileUrl, detail: "high" } },
        { type: "text", text: USER_PROMPT },
      ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 2048,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[OCR/openai] API error:", response.status, errText);
      return buildFallback();
    }

    const json = await response.json();
    const rawContent: string = json.choices?.[0]?.message?.content ?? "";

    // Strip markdown code fences if the model wrapped the JSON
    const cleaned = rawContent
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let extracted: OpenAIExtracted;
    try {
      extracted = JSON.parse(cleaned) as OpenAIExtracted;
    } catch (parseErr) {
      console.error("[OCR/openai] JSON parse failed:", parseErr, "\nRaw:", rawContent);
      return buildFallback();
    }

    const lineItems = (extracted.line_items ?? []).map((item) => ({
      description: item.description ?? "",
      quantity:    item.quantity    ?? undefined,
      unit_price:  item.unit_price  ?? undefined,
      line_total:  item.line_total  ?? 0,
    }));

    return {
      vendor_name:          extracted.vendor_name          ?? undefined,
      invoice_number:       extracted.invoice_number       ?? undefined,
      invoice_date:         extracted.invoice_date         ?? undefined,
      service_period_start: extracted.service_period_start ?? undefined,
      service_period_end:   extracted.service_period_end   ?? undefined,
      subtotal:             extracted.subtotal             ?? undefined,
      tax:                  extracted.tax                  ?? undefined,
      total_amount:         extracted.total_amount         ?? undefined,
      line_items:           lineItems,
      raw_text:             rawContent,
      confidence:           88,
      low_confidence_fields: [],
      provider:             "openai",
    };
  } catch (err) {
    console.error("[OCR/openai] Unexpected error:", err);
    return buildFallback();
  }
}

function buildFallback(): OcrResult {
  return {
    line_items:           [],
    raw_text:             "",
    confidence:           0,
    low_confidence_fields: [],
    provider:             "openai",
  };
}
