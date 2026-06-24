# Vendor Purchasing & Order Tracking — Design

**Date:** 2026-06-24
**Module home:** `/operations/vendor-orders` (under the Operations/Warehouse hub)
**Status:** approved to build (all phases, ship-as-you-go)

## 1. Goal

Track every vendor purchase from request → quote → approval → order → shipment →
delivery → payment in **texasturf-os** as the system of record, with Slack used
only for intake, a daily actionable digest, and one-tap status updates. Minimal
manual entry; built to later link to the Inventory module without a rebuild.

Replaces the original "build it in Monday.com" plan — everything lives natively
on the existing Supabase + Slack-bot + Vercel-cron backbone.

## 2. Data model

### Enums
- `po_status`: `new_request`, `awaiting_review`, `awaiting_approval`,
  `quote_gathering`, `ready_to_order`, `order_placed`, `waiting_on_vendor`,
  `in_transit`, `delivered`, `payment_outstanding`, `closed`, `cancelled`
- `po_priority`: `low`, `normal`, `high`, `urgent`
- `po_purchase_type`: `inventory_replenishment`, `project_specific`
- `po_payment_terms`: `paid_in_full`, `deposit`, `net_15`, `net_30`, `net_45`,
  `due_on_delivery`, `other`
- `po_payment_status`: `not_due`, `due_soon`, `past_due`, `paid`

### `purchase_orders` (one row = one request → order → payment)
**Request:** `id`, `order_number` (human seq), `status` (default `new_request`),
`assigned_buyer_id` → `auth.users` (required in UI), `requested_by` (text — the
requester may not be an app user), `requested_by_id` → `auth.users` (nullable),
`request_date` (default today), `priority` (default `normal`), `needed_by`,
`purchase_type` (default `inventory_replenishment`), `project_id` → `projects`
(Linked Job, optional, mirrors invoices), `job_name` (text), `request_description`
(NOT NULL), `material_needed`, `quantity_needed` (text, e.g. "3 pallets"), `notes`.

**Vendor:** `vendor_id` → `vendors`, `vendor_contact`, `quote_amount`,
`estimated_cost`, `final_order_amount`, `po_number`, `order_date`.

**Shipping:** `carrier`, `tracking_number`, `tracking_url`, `eta`,
`expected_delivery_date`, `actual_delivery_date`.

**Receiving:** `received_by` (text), `quantity_received` (text),
`shortages_reported` (bool), `shortage_notes`, `damage_reported` (bool),
`damage_notes`.

**Payment:** `payment_terms`, `deposit_required` (bool), `deposit_amount`,
`deposit_paid_date`, `remaining_balance`, `invoice_date`, `payment_due_date`,
`payment_status` (default `not_due`), `invoice_id` → `invoices` (nullable — link
the real invoice record once it exists).

**Documents:** `documents` jsonb — manifest array `{path,name,type,size,category}`
in the private `purchase-orders` storage bucket (same pattern as
`app_feedback.attachments`).

**Integration / meta:** `slack_channel_id`, `slack_message_ts`, `slack_thread_ts`,
`inventory_item_id` → `inv_items` (nullable — **future inventory hook, added now
so no rebuild**), `created_by_id` → `auth.users`, `created_at`, `updated_at`,
`status_changed_at`.

### `purchase_order_events` (history + digest/notification source of truth)
`id`, `purchase_order_id` → `purchase_orders` (CASCADE), `previous_status`,
`new_status`, `event_type` (`status_change`|`note`|`slack_action`|`field_update`),
`source` (`app`|`slack`|`cron`|`system`), `changed_by_id`, `notes`, `created_at`.

### Storage
Bucket `purchase-orders`, private (signed URLs), `image/*` + `application/pdf` +
common doc types, 20 MB cap.

### RLS (mirrors invoices)
- Any authenticated user can **insert** a request and **read** orders.
- **admin/office** can update everything (buyer/vendor/shipping/payment/status).
- Field/warehouse: read-only after create.
- `purchase_order_events`: read via parent order; server insert.

## 3. Lifecycle automations (no manual status moves where avoidable)

Enforced inside `updatePurchaseOrder` (and Slack actions), each writes a
`purchase_order_events` row:

| Trigger | Effect |
|---|---|
| Approval action | → `ready_to_order` |
| `po_number` first set | → `order_placed`, `order_date` = today if empty |
| `tracking_number` first set | → `in_transit` |
| `actual_delivery_date` set | → `delivered` |
| `remaining_balance` = 0 (from >0) | → `closed`, `payment_status` = `paid` |

Time-based (daily cron, see §5): derive `payment_status` from `payment_due_date`
+ `remaining_balance`; notify assigned buyer on **payment due ≤ 7 days**,
**ETA past due**, and **request waiting too long** (in `new_request`/
`awaiting_review`/`quote_gathering` > 5 days). Notifications use the existing
`notifications` table + a Slack DM via `openDM`.

## 4. Module files (`src/app/(app)/operations/vendor-orders/`)
- `page.tsx` — board/list grouped by stage, with stage counts + filters.
- `new/page.tsx` + `new/request-form.tsx` — the simple intake form (Vendor Order
  Request): required = description, requested-by, priority, assigned buyer;
  optional = material, quantity, needed-by, linked job, notes.
- `[id]/page.tsx` — full detail, sectioned (Request / Vendor / Shipping /
  Receiving / Payment / Documents / History), office/admin-editable.
- `[id]/*` — section edit forms, status control, file upload, document list.
- `actions.ts` — `createPurchaseOrder`, `updatePurchaseOrder` (automation logic),
  `setStatus`, file upload/remove.
- `_lib/queries.ts` — list, filters, dashboard aggregates, digest dataset.
- `_lib/status.ts` — stage labels, colors, order, board groupings.
- Add a card to the Operations hub (`operations/page.tsx`) + warehouse can reach
  it via the existing Operations tab.

## 5. Slack architecture (bot already wired — token + signing secret exist)
- **Intake (no auto-parse):** a message shortcut **"Create Vendor Order"** on any
  `#low-inventory` message → opens a prefilled modal; submit creates a
  `new_request`. Plus a `/order` slash command that opens the same modal. Plain
  messages are never auto-parsed.
- **Daily digest:** `GET /api/cron/vendor-digest` (CRON_SECRET-guarded, like
  `/api/cron/recurring`) posts to `#vendor-order-status` (`C0BCA2G4QFQ`) each
  morning: **Needs Ordering**, **Waiting on Vendor**, **In Transit**, **Upcoming
  Payments (≤7d)**, **Overdue** (unordered / delayed / overdue payments). Same
  route runs the time-based automations in §3. Registered in `vercel.json`.
- **Interactive updates:** `POST /api/slack/interactivity` (signature-verified)
  handles `block_actions` from digest/notification messages — **Mark Ordered**,
  **Update ETA** (modal), **Mark Delivered**, **Deposit Paid**, **Invoice
  Received**, **Final Payment Made** — writing back via the service client and
  re-rendering the message. Also handles `view_submission` for the modals.
- **Commands:** `POST /api/slack/commands` for `/order`.
- New helper `src/lib/integrations/slack-purchasing.ts` (reuses `postMessage`,
  `openDM`, `lookupUserByEmail` from `slack.ts`).

## 6. Dashboards (`/operations/vendor-orders/dashboard`, recharts)
- **Purchasing pipeline:** count + value by stage.
- **Vendor spend:** by vendor, by month, open commitments (final_order_amount of
  open orders).
- **Outstanding payments:** upcoming, overdue, outstanding balances.
- **Shipment tracking:** arriving this week, delayed, in transit.

## 7. Config required (Stefan to-dos, exact clicks provided at the end)
- **Env / Vercel:** `SLACK_VENDOR_ORDER_CHANNEL_ID=C0BCA2G4QFQ`,
  `SLACK_LOW_INVENTORY_CHANNEL_ID=C06N5M9LA1K` (optional). Existing:
  `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`.
- **Slack app (api.slack.com/apps):** enable Interactivity (Request URL
  `/api/slack/interactivity`), add the "Create Vendor Order" message shortcut,
  add the `/order` slash command (`/api/slack/commands`), confirm scopes
  (`commands`, `chat:write`, `users:read`, `users:read.email`, `im:write`),
  reinstall.

## 8. Build phases (ship each end-to-end)
1. **Core system of record** — migration + types + RLS, list/board, intake form,
   detail page, automations, file uploads, Operations hub card.
2. **Slack intake + daily digest** — digest cron + time-based automations +
   message shortcut/slash-command modal.
3. **Interactive Slack** — `/api/slack/interactivity` buttons + modals.
4. **Dashboards** — pipeline / vendor spend / outstanding payments / shipments.

## 9. Out of scope (future)
Real inventory decrement on receipt (the `inventory_item_id` FK is the seam);
turf SKU / partial-roll / dye-lot tracking; vendor portal.
