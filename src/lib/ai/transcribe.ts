/**
 * Whisper transcription for the Ad Lab — turns an uploaded ad video/audio
 * into text. Uses the same raw-fetch OpenAI pattern as lib/ocr/openai.ts
 * (OPENAI_API_KEY, no SDK). Server-only.
 */

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; error: "provider_missing" | "transcription_failed"; message: string };

/** Whisper's hard upload limit. Files above this must be trimmed client-side. */
export const TRANSCRIBE_MAX_BYTES = 25 * 1024 * 1024;

/** Cheapest current OpenAI transcription model (~half whisper-1's per-minute
 * price) — used for call recordings (calling suite Phase 3). Ad Lab uploads
 * keep the whisper-1 default. */
export const CALL_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

export async function transcribeMedia(
  file: Blob,
  filename: string,
  model: string = "whisper-1",
): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "provider_missing", message: "Transcription is off — OPENAI_API_KEY is not set." };
  }
  if (file.size === 0) {
    return { ok: false, error: "transcription_failed", message: "The uploaded file is empty." };
  }
  if (file.size > TRANSCRIBE_MAX_BYTES) {
    return {
      ok: false,
      error: "transcription_failed",
      message: "File is over Whisper's 25 MB limit — trim the video or upload audio only.",
    };
  }

  try {
    const form = new FormData();
    form.append("file", file, filename);
    form.append("model", model);
    form.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: "transcription_failed",
        message: `Transcription failed (${response.status}): ${detail.slice(0, 200)}`,
      };
    }
    const json = (await response.json()) as { text?: string };
    if (!json.text?.trim()) {
      return { ok: false, error: "transcription_failed", message: "Whisper returned no speech — is there a voice track?" };
    }
    return { ok: true, text: json.text.trim() };
  } catch (err) {
    return {
      ok: false,
      error: "transcription_failed",
      message: err instanceof Error ? err.message : "Unknown transcription error.",
    };
  }
}
