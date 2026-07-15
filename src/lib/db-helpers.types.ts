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

// resource_ref added in migration 20260710190000; typegen regen is blocked
// until `supabase login` — the intersection bridges until then and is
// harmless once the generated Row includes the column.
export type Notification = Database["public"]["Tables"]["notifications"]["Row"] & {
  resource_ref?: string | null
}
export type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"] & {
  resource_ref?: string | null
}

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

// ---- Finance suite ---------------------------------------------------------
type FinTables = Database["public"]["Tables"]
export type FinCompanySettings = FinTables["fin_company_settings"]["Row"]
export type FinAccount        = FinTables["fin_account"]["Row"]
export type FinAccountInsert  = FinTables["fin_account"]["Insert"]
export type FinPeriod         = FinTables["fin_period"]["Row"]
export type FinAccountValue   = FinTables["fin_account_value"]["Row"]
export type FinBusinessUnit   = FinTables["fin_business_unit"]["Row"]
export type FinSeasonality    = FinTables["fin_seasonality"]["Row"]
export type FinSalesActual    = FinTables["fin_sales_actual"]["Row"]
export type FinProduct        = FinTables["fin_product"]["Row"]
export type FinCostRate       = FinTables["fin_cost_rate"]["Row"]
export type FinLaborRole      = FinTables["fin_labor_role"]["Row"]
export type FinEmployee       = FinTables["fin_employee"]["Row"]
export type FinBurdenRate     = FinTables["fin_burden_rate"]["Row"]
export type FinProfitGoal     = FinTables["fin_profit_goal"]["Row"]
export type FinArInvoice      = FinTables["fin_ar_invoice"]["Row"]
export type FinApBill         = FinTables["fin_ap_bill"]["Row"]
export type FinRecurringCost  = FinTables["fin_recurring_cost"]["Row"]
export type FinDebt           = FinTables["fin_debt"]["Row"]
export type FinCashSnapshot   = FinTables["fin_cash_snapshot"]["Row"]
export type FinMetric         = FinTables["fin_metric"]["Row"]
export type FinMetricValue    = FinTables["fin_metric_value"]["Row"]

// ---- Vendor purchasing & order tracking ------------------------------------
export type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"]
export type PurchaseOrderInsert = Database["public"]["Tables"]["purchase_orders"]["Insert"]
export type PurchaseOrderUpdate = Database["public"]["Tables"]["purchase_orders"]["Update"]
export type PurchaseOrderEvent = Database["public"]["Tables"]["purchase_order_events"]["Row"]
export type PurchaseOrderEventInsert = Database["public"]["Tables"]["purchase_order_events"]["Insert"]
export type PoStatus = Database["public"]["Enums"]["po_status"]
export type PoPriority = Database["public"]["Enums"]["po_priority"]
export type PoPurchaseType = Database["public"]["Enums"]["po_purchase_type"]
export type PoPaymentTerms = Database["public"]["Enums"]["po_payment_terms"]
export type PoPaymentStatus = Database["public"]["Enums"]["po_payment_status"]

// Shape of each entry in purchase_orders.documents (manifest of files in the
// private `purchase-orders` storage bucket).
export type PoDocument = {
  path: string   // object path within the `purchase-orders` bucket
  name: string   // original filename
  type: string   // mime type
  size: number   // bytes
  category?: string  // 'quote' | 'po' | 'invoice' | 'shipping' | 'photo' | 'other'
}

// ---- Finance suite: QuickBooks seam ----------------------------------------
export type FinQbAccountMap = Database["public"]["Tables"]["fin_qb_account_map"]["Row"]
export type FinSyncLog      = Database["public"]["Tables"]["fin_sync_log"]["Row"]

// ---- Financial engine: config tables (Step 2 of the holistic rebuild) ------
// (FinCostRate already aliased in the finance-suite section above.)
export type FinCommissionTier = Database["public"]["Tables"]["fin_commission_tier"]["Row"]
export type FinMileageBand    = Database["public"]["Tables"]["fin_mileage_band"]["Row"]
export type FinProductRow     = Database["public"]["Tables"]["fin_product"]["Row"]

// ---- Editable content (CMS) ------------------------------------------------
export type ContentBlockRow = Database["public"]["Tables"]["content_blocks"]["Row"]

// ---- Content funnel: assignee ----------------------------------------------
export type ContentAssignee = Database["public"]["Enums"]["content_assignee"]

// ---- Marketing OS: AI generations + business inputs -------------------------
export type MarketingAiGeneration   = Database["public"]["Tables"]["marketing_ai_generations"]["Row"]
export type MarketingBusinessInput  = Database["public"]["Tables"]["marketing_business_inputs"]["Row"]

// ---- TurfCasa (sister-brand outlet): orders + catalog ------------------------
export type TurfcasaProduct    = Database["public"]["Tables"]["turfcasa_products"]["Row"]
export type TurfcasaOrder      = Database["public"]["Tables"]["turfcasa_orders"]["Row"]
export type TurfcasaOrderLine  = Database["public"]["Tables"]["turfcasa_order_lines"]["Row"]
export type TurfcasaOrderEvent = Database["public"]["Tables"]["turfcasa_order_events"]["Row"]
export type TurfcasaOrderInsert     = Database["public"]["Tables"]["turfcasa_orders"]["Insert"]
export type TurfcasaOrderLineInsert = Database["public"]["Tables"]["turfcasa_order_lines"]["Insert"]

// ---- Marketing OS: Ad Lab swipes ---------------------------------------------
export type MarketingAdSwipe = Database["public"]["Tables"]["marketing_ad_swipes"]["Row"]

// ---- Calling suite: power dialer (Phase 1) -----------------------------------
export type CallList           = Database["public"]["Tables"]["call_lists"]["Row"]
export type CallListInsert     = Database["public"]["Tables"]["call_lists"]["Insert"]
export type CallListItem       = Database["public"]["Tables"]["call_list_items"]["Row"]
export type CallListItemInsert = Database["public"]["Tables"]["call_list_items"]["Insert"]
export type CallAttempt        = Database["public"]["Tables"]["call_attempts"]["Row"]
export type CallAttemptInsert  = Database["public"]["Tables"]["call_attempts"]["Insert"]

// ---- Calling suite: recorded calls (Phase 2) ---------------------------------
export type CallRow        = Database["public"]["Tables"]["calls"]["Row"]
export type CallRowInsert  = Database["public"]["Tables"]["calls"]["Insert"]
export type CallSetting    = Database["public"]["Tables"]["call_settings"]["Row"]

// ---- Calling suite: AI call reviews (Phase 3) --------------------------------
export type CallAiReview       = Database["public"]["Tables"]["call_ai_reviews"]["Row"]
export type CallAiReviewInsert = Database["public"]["Tables"]["call_ai_reviews"]["Insert"]

// ---- Tags (app-wide registry + polymorphic link) ------------------------------
export type Tag = Database["public"]["Tables"]["tags"]["Row"]
export type TagInsert = Database["public"]["Tables"]["tags"]["Insert"]
export type EntityTag = Database["public"]["Tables"]["entity_tags"]["Row"]
export type EntityTagInsert = Database["public"]["Tables"]["entity_tags"]["Insert"]
export type TaggableEntity = Database["public"]["Enums"]["taggable_entity"]
