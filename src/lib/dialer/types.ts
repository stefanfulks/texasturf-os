// App-facing dialer types + labels. The DB columns are text + CHECK (repo
// convention), so the precise unions live here and rows are narrowed on read.
// Spec: docs/superpowers/specs/2026-06-25-power-dialer-design.md (+ 2026-07-15
// calling-suite prompt, which adds turfcasa_customer targets and brands).

export type DialTargetType = "sales_contact" | "jobber_client" | "turfcasa_customer";

export type CallListStatus = "active" | "completed" | "archived";
export type CallItemStatus = "pending" | "called" | "skipped" | "done";

export type CallOutcome =
  | "connected"
  | "no_answer"
  | "voicemail"
  | "busy"
  | "bad_number"
  | "callback_scheduled"
  | "not_interested"
  | "do_not_call";

export type DialerBrand = "texasturf" | "turfcasa";

/** Disposition buttons, in keyboard-shortcut order (1–8 on the dial screen). */
export const CALL_OUTCOMES: readonly { value: CallOutcome; label: string; terminal: boolean }[] = [
  { value: "connected",          label: "Connected",       terminal: true },
  { value: "no_answer",          label: "No answer",       terminal: false },
  { value: "voicemail",          label: "Voicemail",       terminal: false },
  { value: "busy",               label: "Busy",            terminal: false },
  { value: "bad_number",         label: "Bad number",      terminal: true },
  { value: "callback_scheduled", label: "Callback",        terminal: false },
  { value: "not_interested",     label: "Not interested",  terminal: true },
  { value: "do_not_call",        label: "Do not call",     terminal: true },
] as const;

export const OUTCOME_LABELS: Record<CallOutcome, string> = Object.fromEntries(
  CALL_OUTCOMES.map((o) => [o.value, o.label]),
) as Record<CallOutcome, string>;

export const TARGET_TYPE_LABELS: Record<DialTargetType, string> = {
  sales_contact: "Contact",
  jobber_client: "Jobber client",
  turfcasa_customer: "TurfCasa customer",
};

/** A dialable candidate in the list builder (pre-insert shape). */
export type DialCandidate = {
  targetType: DialTargetType;
  targetId: string;
  name: string;
  phone: string;
  company: string | null;
  /** Context chip shown in the builder (stage, balance, order count, …). */
  meta: string | null;
};

/** Normalize a phone to bare digits (last 10 kept for US numbers with a
 * country code). Used both to dedupe TurfCasa customers and as their
 * target_id, since orders have no standalone customer record. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}
