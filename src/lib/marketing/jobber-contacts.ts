// Helpers for reading contact info out of the jobber_clients mirror's JSON
// columns. Shapes per src/lib/jobber/sync/clients.ts:
//   phones: { number, description, primary }[]
//   emails: { address, description, primary }[]

type JobberPhone = { number?: unknown; description?: unknown; primary?: unknown };
type JobberEmail = { address?: unknown; description?: unknown; primary?: unknown };

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Primary phone number, falling back to the first one with digits. */
export function primaryPhone(phones: unknown): string | null {
  const list = asArray(phones) as JobberPhone[];
  const pick =
    list.find((p) => p?.primary === true && typeof p.number === "string") ??
    list.find((p) => typeof p?.number === "string" && (p.number as string).trim() !== "");
  return pick ? String(pick.number).trim() : null;
}

/** Primary email address, falling back to the first non-empty one. */
export function primaryEmail(emails: unknown): string | null {
  const list = asArray(emails) as JobberEmail[];
  const pick =
    list.find((e) => e?.primary === true && typeof e.address === "string") ??
    list.find((e) => typeof e?.address === "string" && (e.address as string).trim() !== "");
  return pick ? String(pick.address).trim() : null;
}

/** Display name: "First Last", else company, else the Jobber id. */
export function clientDisplayName(c: {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  id: string;
}): string {
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return person || c.company_name?.trim() || c.id;
}
