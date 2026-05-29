import type { OcrResult } from "./types";
import { runMockOcr } from "./mock";
import { runOcrOpenAI } from "./openai";

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
  fileType?: string,
): Promise<OcrResult> {
  switch (OCR_PROVIDER) {
    case "openai":
      return runOcrOpenAI(fileUrl, fileType ?? "image/jpeg");
    case "mock":
    default:
      return runMockOcr(fileUrl, vendorName, manualTotal);
  }
}

/**
 * Alias used by the Slack webhook and other callers that pass fileType directly.
 */
export async function runOcr(fileUrl: string, fileType: string): Promise<OcrResult> {
  return extractInvoiceData(fileUrl, undefined, undefined, fileType);
}
