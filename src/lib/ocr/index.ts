import type { OcrResult } from "./types";
import { runMockOcr } from "./mock";

export type { OcrResult };

const OCR_PROVIDER = process.env.OCR_PROVIDER ?? "mock";

/**
 * Run OCR on an invoice file.
 * Swap provider by setting OCR_PROVIDER env var to 'openai' | 'textract' | 'azure' | 'mock'.
 */
export async function extractInvoiceData(
  fileUrl: string,
  vendorName?: string,
  manualTotal?: number,
): Promise<OcrResult> {
  switch (OCR_PROVIDER) {
    case "mock":
    default:
      return runMockOcr(fileUrl, vendorName, manualTotal);
  }
}
