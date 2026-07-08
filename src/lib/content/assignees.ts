/**
 * Content funnel — the four filming pillars. Shared between the board (card
 * face + filters) and the detail panel (assignee picker). Assignee is a fixed
 * enum (not a profile FK) because these are filming ROLES, not accounts:
 *   warehouse = POV / b-roll from job sites and the yard
 *   ivana     = lifestyle / family / home-aesthetic content
 *   stefan    = cost/ROI/comparison talking-head + paid ad creative
 *   troy      = educational 101/FAQ, long-form YouTube
 */
import { Warehouse, User, GraduationCap, type LucideIcon } from "lucide-react";
import type { ContentAssignee } from "@/lib/db-helpers.types";

export const ASSIGNEES: readonly ContentAssignee[] = ["warehouse", "ivana", "stefan", "troy"] as const;

export const ASSIGNEE_META: Record<ContentAssignee, { label: string; icon: LucideIcon; chip: string; medallion: string }> = {
  warehouse: { label: "Warehouse", icon: Warehouse,      chip: "chip-neutral", medallion: "" },
  ivana:     { label: "Ivana",     icon: User,           chip: "chip-brand",   medallion: "medallion-brand" },
  stefan:    { label: "Stefan",    icon: User,           chip: "chip-warn",    medallion: "medallion-warn" },
  troy:      { label: "Troy",      icon: GraduationCap,  chip: "chip-info",    medallion: "medallion-info" },
};

export function assigneeLabel(a: ContentAssignee | null): string {
  return a ? ASSIGNEE_META[a].label : "Unassigned";
}
