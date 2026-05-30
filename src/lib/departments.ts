/**
 * Department model — what a user DOES every day. Drives the personalized
 * dashboard and nav surface. Orthogonal to `role`, which is the permission
 * tier (admin / office / field).
 */

export const DEPARTMENTS = [
  "sales",
  "warehouse",
  "office",
  "field",
  "marketing",
  "financial",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export function isDepartment(v: unknown): v is Department {
  return typeof v === "string" && (DEPARTMENTS as readonly string[]).includes(v);
}

export const DEPARTMENT_LABEL: Record<Department, string> = {
  sales:     "Sales",
  warehouse: "Warehouse",
  office:    "Office",
  field:     "Field",
  marketing: "Marketing",
  financial: "Financial",
};

export const DEPARTMENT_EMOJI: Record<Department, string> = {
  sales:     "💼",
  warehouse: "📦",
  office:    "🏢",
  field:     "🏗️",
  marketing: "📣",
  financial: "💰",
};

export const DEPARTMENT_HREF: Record<Department, string> = {
  sales:     "/sales",
  warehouse: "/warehouse",
  office:    "/office",
  field:     "/field",
  marketing: "/marketing",
  financial: "/financial",
};

export const DEPARTMENT_DESCRIPTION: Record<Department, string> = {
  sales:     "Quoting, leads, customer projects.",
  warehouse: "Rolls, jobs, receiving, cuts, returns.",
  office:    "Invoices, vendors, projects, fleet.",
  field:     "Installer view: assigned jobs, schedule, time tracking.",
  marketing: "Content, campaigns, SEO, reviews.",
  financial: "Reports, budgets, P&L, cash flow.",
};

/**
 * Order departments with the user's own first, then the rest in canonical
 * order. If the user has no department set, returns the canonical order.
 */
export function orderForUser(user: Department | null | undefined): Department[] {
  if (!user || !isDepartment(user)) return [...DEPARTMENTS];
  return [user, ...DEPARTMENTS.filter((d) => d !== user)];
}
