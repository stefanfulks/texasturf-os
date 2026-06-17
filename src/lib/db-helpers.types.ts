// Hand-curated convenience aliases over the generated Supabase schema types.
//
// `src/lib/database.types.ts` is pure generator output — `pnpm typegen`
// OVERWRITES that whole file, so never add manual exports there. Add new
// aliases here instead; the generator never touches this file.

import type { Database } from "@/lib/database.types"

// Convenience row types — use these throughout the app instead of repeating the long path
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Asset = Database["public"]["Tables"]["assets"]["Row"]
export type MaintenanceSchedule = Database["public"]["Tables"]["maintenance_schedules"]["Row"]
export type MaintenanceLog = Database["public"]["Tables"]["maintenance_logs"]["Row"]

export type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"]
export type AssetUpdate = Database["public"]["Tables"]["assets"]["Update"]

// Task types
export type Task = Database["public"]["Tables"]["tasks"]["Row"]
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"]
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"]
export type TaskComment = Database["public"]["Tables"]["task_comments"]["Row"]
export type TaskActivity = Database["public"]["Tables"]["task_activity"]["Row"]
export type Department = Database["public"]["Tables"]["departments"]["Row"]

// Enum value types
export type UserRole = Database["public"]["Enums"]["user_role"]
export type UnitType = Database["public"]["Enums"]["unit_type"]
export type AssetStatus = Database["public"]["Enums"]["asset_status"]
export type ReadyStatus = Database["public"]["Enums"]["ready_status"]
export type LoadStatus = Database["public"]["Enums"]["load_status"]
export type MaintenanceIntervalType = Database["public"]["Enums"]["maintenance_interval_type"]
export type TaskStatus = Database["public"]["Enums"]["task_status"]
export type TaskPriority = Database["public"]["Enums"]["task_priority"]
export type TaskVisibility = Database["public"]["Enums"]["task_visibility"]

export type RecurringRule = Database["public"]["Tables"]["recurring_rules"]["Row"]
export type RecurringRuleInsert = Database["public"]["Tables"]["recurring_rules"]["Insert"]
export type RecurrenceFreq = Database["public"]["Enums"]["recurrence_freq"]

export type Notification = Database["public"]["Tables"]["notifications"]["Row"]
export type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"]

export type Project = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
export type ProjectStatus = Database["public"]["Enums"]["project_status"]
export type ProjectType = Database["public"]["Enums"]["project_type"]

// Invoice types
export type Vendor = Database["public"]["Tables"]["vendors"]["Row"]
export type VendorInsert = Database["public"]["Tables"]["vendors"]["Insert"]
export type VendorType = Database["public"]["Enums"]["vendor_type"]

export type Invoice = Database["public"]["Tables"]["invoices"]["Row"]
export type InvoiceInsert = Database["public"]["Tables"]["invoices"]["Insert"]
export type InvoiceUpdate = Database["public"]["Tables"]["invoices"]["Update"]
export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"]

export type InvoiceLineItem = Database["public"]["Tables"]["invoice_line_items"]["Row"]
export type InvoiceLineItemInsert = Database["public"]["Tables"]["invoice_line_items"]["Insert"]
export type InvoiceStatusHistory = Database["public"]["Tables"]["invoice_status_history"]["Row"]
export type InvoiceComment = Database["public"]["Tables"]["invoice_comments"]["Row"]
export type InvoiceVersion = Database["public"]["Tables"]["invoice_versions"]["Row"]
export type OcrJob = Database["public"]["Tables"]["ocr_jobs"]["Row"]
export type IntegrationSyncLog = Database["public"]["Tables"]["integration_sync_logs"]["Row"]

// Reports / KPI types
export type Budget = Database["public"]["Tables"]["budgets"]["Row"]
export type BudgetInsert = Database["public"]["Tables"]["budgets"]["Insert"]
export type KpiEntry = Database["public"]["Tables"]["kpi_entries"]["Row"]
export type KpiEntryInsert = Database["public"]["Tables"]["kpi_entries"]["Insert"]

// Team Performance types
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"]
export type TeamMemberInsert = Database["public"]["Tables"]["team_members"]["Insert"]
export type TeamMemberUpdate = Database["public"]["Tables"]["team_members"]["Update"]

export type TeamKpiDefinition = Database["public"]["Tables"]["team_kpi_definitions"]["Row"]
export type TeamKpiDefinitionInsert = Database["public"]["Tables"]["team_kpi_definitions"]["Insert"]

export type TeamKpiEntry = Database["public"]["Tables"]["team_kpi_entries"]["Row"]
export type TeamKpiEntryInsert = Database["public"]["Tables"]["team_kpi_entries"]["Insert"]
export type TeamKpiEntryUpdate = Database["public"]["Tables"]["team_kpi_entries"]["Update"]

// Inventory Manager types
export type InvLocation = Database["public"]["Tables"]["inv_locations"]["Row"]
export type InvProduct = Database["public"]["Tables"]["inv_products"]["Row"]
export type InvRoll = Database["public"]["Tables"]["inv_rolls"]["Row"]
export type InvJob = Database["public"]["Tables"]["inv_jobs"]["Row"]
export type InvAllocation = Database["public"]["Tables"]["inv_allocations"]["Row"]
export type InvTransaction = Database["public"]["Tables"]["inv_transactions"]["Row"]
export type InvItem = Database["public"]["Tables"]["inv_items"]["Row"]
export type InvSetting = Database["public"]["Tables"]["inv_settings"]["Row"]
export type InvSettingInsert = Database["public"]["Tables"]["inv_settings"]["Insert"]
export type RollStatus = Database["public"]["Enums"]["roll_status"]
export type RollType = Database["public"]["Enums"]["roll_type"]

// Pitch (in-app sales deck) types
export type PitchTier = Database["public"]["Tables"]["pitch_tiers"]["Row"]
export type PitchSession = Database["public"]["Tables"]["pitch_sessions"]["Row"]
export type PitchDeck = Database["public"]["Tables"]["pitch_decks"]["Row"]
export type PitchArea = Database["public"]["Tables"]["pitch_areas"]["Row"]
export type PitchAddon = Database["public"]["Tables"]["pitch_addons"]["Row"]
export type PitchSiteDoc = Database["public"]["Tables"]["pitch_site_docs"]["Row"]
export type PitchPhoto = Database["public"]["Tables"]["pitch_photos"]["Row"]

// App feedback (bugs / ideas / questions about the app itself)
export type AppFeedback = Database["public"]["Tables"]["app_feedback"]["Row"]
export type AppFeedbackInsert = Database["public"]["Tables"]["app_feedback"]["Insert"]

// Shape of each entry in app_feedback.attachments — a small JSON manifest of
// screenshots uploaded to the private `feedback` storage bucket.
export type FeedbackAttachment = {
  path: string  // object path within the `feedback` bucket
  name: string  // original filename (shown in the lightbox)
  type: string  // mime type
  size: number  // bytes
}
