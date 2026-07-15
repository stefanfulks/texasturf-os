// Display helpers for the calls surfaces (list, detail, coaching).

export const OUTCOME_CLASS_LABELS: Record<string, string> = {
  connected_interested: "Connected · interested",
  connected_not_interested: "Connected · not interested",
  callback_requested: "Callback requested",
  voicemail: "Voicemail",
  wrong_number: "Wrong number",
  no_decision: "No decision",
};

/** Interest 1–5 → chip variant: hot leads pop, do-not-calls warn. */
export function interestChipClass(level: number): string {
  if (level >= 4) return "chip-brand";
  if (level <= 1) return "chip-danger";
  if (level === 2) return "chip-neutral";
  return "chip-info";
}
