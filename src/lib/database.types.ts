export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_feedback: {
        Row: {
          admin_notes: string | null
          attachments: Json
          body: string | null
          category: Database["public"]["Enums"]["feedback_category"]
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          page_url: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["feedback_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          attachments?: Json
          body?: string | null
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          page_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          attachments?: Json
          body?: string | null
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          page_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_feedback_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_feedback_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          archived: boolean
          attached_to_id: string | null
          created_at: string
          id: string
          identifier: string | null
          load_status: Database["public"]["Enums"]["load_status"]
          make: string | null
          model: string | null
          monday_item_id: string | null
          name: string
          next_action: string | null
          notes: string | null
          owner_id: string | null
          primary_unit: boolean
          ready_status: Database["public"]["Enums"]["ready_status"]
          status: Database["public"]["Enums"]["asset_status"]
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
          year: number | null
        }
        Insert: {
          archived?: boolean
          attached_to_id?: string | null
          created_at?: string
          id?: string
          identifier?: string | null
          load_status?: Database["public"]["Enums"]["load_status"]
          make?: string | null
          model?: string | null
          monday_item_id?: string | null
          name: string
          next_action?: string | null
          notes?: string | null
          owner_id?: string | null
          primary_unit?: boolean
          ready_status?: Database["public"]["Enums"]["ready_status"]
          status?: Database["public"]["Enums"]["asset_status"]
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          archived?: boolean
          attached_to_id?: string | null
          created_at?: string
          id?: string
          identifier?: string | null
          load_status?: Database["public"]["Enums"]["load_status"]
          make?: string | null
          model?: string | null
          monday_item_id?: string | null
          name?: string
          next_action?: string | null
          notes?: string | null
          owner_id?: string | null
          primary_unit?: boolean
          ready_status?: Database["public"]["Enums"]["ready_status"]
          status?: Database["public"]["Enums"]["asset_status"]
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_attached_to_id_fkey"
            columns: ["attached_to_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          budgeted_amount: number
          category: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          period_month: number
          period_year: number
          updated_at: string | null
        }
        Insert: {
          budgeted_amount?: number
          category: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          period_month: number
          period_year: number
          updated_at?: string | null
        }
        Update: {
          budgeted_amount?: number
          category?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          period_month?: number
          period_year?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brief_md: string | null
          channels: Json
          created_at: string
          created_by_id: string | null
          ends_on: string | null
          id: string
          jobber_copy: Json
          name: string
          results: Json
          service_line: string | null
          slug: string
          starts_on: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at: string
        }
        Insert: {
          brief_md?: string | null
          channels?: Json
          created_at?: string
          created_by_id?: string | null
          ends_on?: string | null
          id?: string
          jobber_copy?: Json
          name: string
          results?: Json
          service_line?: string | null
          slug: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Update: {
          brief_md?: string | null
          channels?: Json
          created_at?: string
          created_by_id?: string | null
          ends_on?: string | null
          id?: string
          jobber_copy?: Json
          name?: string
          results?: Json
          service_line?: string | null
          slug?: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_blocks: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      content_items: {
        Row: {
          asset_path: string | null
          assignee: Database["public"]["Enums"]["content_assignee"] | null
          b_roll_md: string | null
          created_at: string
          created_by_id: string | null
          creator_id: string | null
          drive_url: string | null
          hook: string | null
          id: string
          job_ref: string | null
          props_md: string | null
          published_channels: Json
          published_on: string | null
          script_md: string | null
          service_line: string | null
          shot_list_md: string | null
          shot_on: string | null
          status: Database["public"]["Enums"]["content_item_status"]
          tag: string | null
          title: string
          type: Database["public"]["Enums"]["content_item_type"]
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          asset_path?: string | null
          assignee?: Database["public"]["Enums"]["content_assignee"] | null
          b_roll_md?: string | null
          created_at?: string
          created_by_id?: string | null
          creator_id?: string | null
          drive_url?: string | null
          hook?: string | null
          id?: string
          job_ref?: string | null
          props_md?: string | null
          published_channels?: Json
          published_on?: string | null
          script_md?: string | null
          service_line?: string | null
          shot_list_md?: string | null
          shot_on?: string | null
          status?: Database["public"]["Enums"]["content_item_status"]
          tag?: string | null
          title: string
          type?: Database["public"]["Enums"]["content_item_type"]
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          asset_path?: string | null
          assignee?: Database["public"]["Enums"]["content_assignee"] | null
          b_roll_md?: string | null
          created_at?: string
          created_by_id?: string | null
          creator_id?: string | null
          drive_url?: string | null
          hook?: string | null
          id?: string
          job_ref?: string | null
          props_md?: string | null
          published_channels?: Json
          published_on?: string | null
          script_md?: string | null
          service_line?: string | null
          shot_list_md?: string | null
          shot_on?: string | null
          status?: Database["public"]["Enums"]["content_item_status"]
          tag?: string | null
          title?: string
          type?: Database["public"]["Enums"]["content_item_type"]
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activities: {
        Row: {
          body: string | null
          created_by: string | null
          deal_id: string
          direction: string | null
          id: string
          kind: string
          metadata: Json
          occurred_at: string
        }
        Insert: {
          body?: string | null
          created_by?: string | null
          deal_id: string
          direction?: string | null
          id?: string
          kind: string
          metadata?: Json
          occurred_at?: string
        }
        Update: {
          body?: string | null
          created_by?: string | null
          deal_id?: string
          direction?: string | null
          id?: string
          kind?: string
          metadata?: Json
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          closed_at: string | null
          created_at: string
          expected_close_date: string | null
          id: string
          jobber_client_id: string | null
          lost_reason: string | null
          name: string
          next_step: string | null
          next_step_date: string | null
          notes: string | null
          owner_id: string | null
          sales_contact_id: string | null
          service_line: string | null
          sqft: number | null
          stage: string
          stage_entered_at: string
          stage_tasks: Json
          updated_at: string
          value_usd: number | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          jobber_client_id?: string | null
          lost_reason?: string | null
          name: string
          next_step?: string | null
          next_step_date?: string | null
          notes?: string | null
          owner_id?: string | null
          sales_contact_id?: string | null
          service_line?: string | null
          sqft?: number | null
          stage?: string
          stage_entered_at?: string
          stage_tasks?: Json
          updated_at?: string
          value_usd?: number | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          jobber_client_id?: string | null
          lost_reason?: string | null
          name?: string
          next_step?: string | null
          next_step_date?: string | null
          notes?: string | null
          owner_id?: string | null
          sales_contact_id?: string | null
          service_line?: string | null
          sqft?: number | null
          stage?: string
          stage_entered_at?: string
          stage_tasks?: Json
          updated_at?: string
          value_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_jobber_client_id_fkey"
            columns: ["jobber_client_id"]
            isOneToOne: false
            referencedRelation: "jobber_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_sales_contact_id_fkey"
            columns: ["sales_contact_id"]
            isOneToOne: false
            referencedRelation: "sales_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      fin_account: {
        Row: {
          active: boolean
          cost_behavior: string
          created_at: string
          direct_type: string
          id: string
          name: string
          reclass_note: string | null
          section: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost_behavior: string
          created_at?: string
          direct_type?: string
          id: string
          name: string
          reclass_note?: string | null
          section: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost_behavior?: string
          created_at?: string
          direct_type?: string
          id?: string
          name?: string
          reclass_note?: string | null
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      fin_account_value: {
        Row: {
          account_id: string
          actual_amount: number
          budget_amount: number
          created_at: string
          id: string
          period_id: string
          source: string
          updated_at: string
        }
        Insert: {
          account_id: string
          actual_amount?: number
          budget_amount?: number
          created_at?: string
          id?: string
          period_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          actual_amount?: number
          budget_amount?: number
          created_at?: string
          id?: string
          period_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_account_value_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_account_value_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "fin_period"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_ap_bill: {
        Row: {
          bill_num: string | null
          created_at: string
          due_date: string | null
          expected_pay_date: string | null
          external_id: string | null
          id: string
          invoice_date: string | null
          open_balance: number
          payment_type: string
          source_invoice_id: string | null
          terms: string | null
          updated_at: string
          vendor: string
        }
        Insert: {
          bill_num?: string | null
          created_at?: string
          due_date?: string | null
          expected_pay_date?: string | null
          external_id?: string | null
          id?: string
          invoice_date?: string | null
          open_balance?: number
          payment_type?: string
          source_invoice_id?: string | null
          terms?: string | null
          updated_at?: string
          vendor: string
        }
        Update: {
          bill_num?: string | null
          created_at?: string
          due_date?: string | null
          expected_pay_date?: string | null
          external_id?: string | null
          id?: string
          invoice_date?: string | null
          open_balance?: number
          payment_type?: string
          source_invoice_id?: string | null
          terms?: string | null
          updated_at?: string
          vendor?: string
        }
        Relationships: []
      }
      fin_ar_invoice: {
        Row: {
          created_at: string
          customer: string
          due_date: string | null
          expected_receipt_date: string | null
          external_id: string | null
          funds_available_date: string | null
          id: string
          invoice_date: string | null
          invoice_num: string | null
          open_balance: number
          result: string
          terms: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer: string
          due_date?: string | null
          expected_receipt_date?: string | null
          external_id?: string | null
          funds_available_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_num?: string | null
          open_balance?: number
          result?: string
          terms?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer?: string
          due_date?: string | null
          expected_receipt_date?: string | null
          external_id?: string | null
          funds_available_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_num?: string | null
          open_balance?: number
          result?: string
          terms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fin_burden_rate: {
        Row: {
          created_at: string
          fica_cap: number
          fica_rate: number
          fiscal_year: number
          futa_cap: number
          futa_rate: number
          id: string
          medicare_rate: number
          state: string
          suta_cap: number
          suta_rate: number
          updated_at: string
          wc_category: string
          wc_rate_per_100: number
        }
        Insert: {
          created_at?: string
          fica_cap?: number
          fica_rate?: number
          fiscal_year: number
          futa_cap?: number
          futa_rate?: number
          id?: string
          medicare_rate?: number
          state?: string
          suta_cap?: number
          suta_rate?: number
          updated_at?: string
          wc_category?: string
          wc_rate_per_100?: number
        }
        Update: {
          created_at?: string
          fica_cap?: number
          fica_rate?: number
          fiscal_year?: number
          futa_cap?: number
          futa_rate?: number
          id?: string
          medicare_rate?: number
          state?: string
          suta_cap?: number
          suta_rate?: number
          updated_at?: string
          wc_category?: string
          wc_rate_per_100?: number
        }
        Relationships: []
      }
      fin_business_unit: {
        Row: {
          active: boolean
          annual_budget: number
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          annual_budget?: number
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          annual_budget?: number
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fin_cash_snapshot: {
        Row: {
          created_at: string
          ending_avail_credit: number
          ending_cash: number
          id: string
          period_id: string
          starting_avail_credit: number
          starting_cash: number
          total_credit_limit: number
          updated_at: string
          working_capital: number
        }
        Insert: {
          created_at?: string
          ending_avail_credit?: number
          ending_cash?: number
          id?: string
          period_id: string
          starting_avail_credit?: number
          starting_cash?: number
          total_credit_limit?: number
          updated_at?: string
          working_capital?: number
        }
        Update: {
          created_at?: string
          ending_avail_credit?: number
          ending_cash?: number
          id?: string
          period_id?: string
          starting_avail_credit?: number
          starting_cash?: number
          total_credit_limit?: number
          updated_at?: string
          working_capital?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_cash_snapshot_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: true
            referencedRelation: "fin_period"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_change_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      fin_commission_tier: {
        Row: {
          created_at: string
          id: string
          label: string | null
          max_margin_pct: number | null
          min_margin_pct: number
          rate_pct: number
          requires_review: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          max_margin_pct?: number | null
          min_margin_pct: number
          rate_pct?: number
          requires_review?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          max_margin_pct?: number | null
          min_margin_pct?: number
          rate_pct?: number
          requires_review?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      fin_company_settings: {
        Row: {
          annual_revenue_plan: number
          company_name: string
          created_at: string
          crew_count: number
          current_utilization: number
          employee_overhead_uplift: number
          fiscal_year: number
          fiscal_year_start_date: string
          goal_utilization: number
          labor_model: string
          notes: string | null
          overhead_mode: string
          overhead_pinned_rate: number
          sqft_per_crew_day: number
          standard_hours_per_year: number
          total_credit_limit: number
          updated_at: string
          work_days_per_week: number
          work_hours_per_day: number
        }
        Insert: {
          annual_revenue_plan?: number
          company_name?: string
          created_at?: string
          crew_count?: number
          current_utilization?: number
          employee_overhead_uplift?: number
          fiscal_year: number
          fiscal_year_start_date: string
          goal_utilization?: number
          labor_model?: string
          notes?: string | null
          overhead_mode?: string
          overhead_pinned_rate?: number
          sqft_per_crew_day?: number
          standard_hours_per_year?: number
          total_credit_limit?: number
          updated_at?: string
          work_days_per_week?: number
          work_hours_per_day?: number
        }
        Update: {
          annual_revenue_plan?: number
          company_name?: string
          created_at?: string
          crew_count?: number
          current_utilization?: number
          employee_overhead_uplift?: number
          fiscal_year?: number
          fiscal_year_start_date?: string
          goal_utilization?: number
          labor_model?: string
          notes?: string | null
          overhead_mode?: string
          overhead_pinned_rate?: number
          sqft_per_crew_day?: number
          standard_hours_per_year?: number
          total_credit_limit?: number
          updated_at?: string
          work_days_per_week?: number
          work_hours_per_day?: number
        }
        Relationships: []
      }
      fin_cost_rate: {
        Row: {
          created_at: string
          effective_fiscal_year: number
          id: string
          key: string
          unit: string | null
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          effective_fiscal_year: number
          id?: string
          key: string
          unit?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          effective_fiscal_year?: number
          id?: string
          key?: string
          unit?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      fin_debt: {
        Row: {
          asset: string | null
          created_at: string
          current_balance: number
          id: string
          interest_pct: number
          lender: string
          monthly_payment: number
          updated_at: string
        }
        Insert: {
          asset?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          interest_pct?: number
          lender: string
          monthly_payment?: number
          updated_at?: string
        }
        Update: {
          asset?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          interest_pct?: number
          lender?: string
          monthly_payment?: number
          updated_at?: string
        }
        Relationships: []
      }
      fin_employee: {
        Row: {
          active: boolean
          annual_ot_hours: number
          benefits_annual: number
          bonus_annual: number
          created_at: string
          current_pay: number
          holiday_days: number
          hours_per_week: number
          id: string
          is_billable: boolean
          linked_profile_id: string | null
          linked_warehouse_employee_id: string | null
          name: string
          pay_type: string
          pto_days: number
          role_id: string | null
          shutdown_days: number
          sick_days: number
          start_date: string | null
          state: string
          tax_classification: string
          updated_at: string
          vacation_days: number
          wc_category: string | null
          weeks_per_year: number
        }
        Insert: {
          active?: boolean
          annual_ot_hours?: number
          benefits_annual?: number
          bonus_annual?: number
          created_at?: string
          current_pay?: number
          holiday_days?: number
          hours_per_week?: number
          id?: string
          is_billable?: boolean
          linked_profile_id?: string | null
          linked_warehouse_employee_id?: string | null
          name: string
          pay_type?: string
          pto_days?: number
          role_id?: string | null
          shutdown_days?: number
          sick_days?: number
          start_date?: string | null
          state?: string
          tax_classification?: string
          updated_at?: string
          vacation_days?: number
          wc_category?: string | null
          weeks_per_year?: number
        }
        Update: {
          active?: boolean
          annual_ot_hours?: number
          benefits_annual?: number
          bonus_annual?: number
          created_at?: string
          current_pay?: number
          holiday_days?: number
          hours_per_week?: number
          id?: string
          is_billable?: boolean
          linked_profile_id?: string | null
          linked_warehouse_employee_id?: string | null
          name?: string
          pay_type?: string
          pto_days?: number
          role_id?: string | null
          shutdown_days?: number
          sick_days?: number
          start_date?: string | null
          state?: string
          tax_classification?: string
          updated_at?: string
          vacation_days?: number
          wc_category?: string | null
          weeks_per_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_employee_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "fin_labor_role"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_labor_role: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fin_metric: {
        Row: {
          created_at: string
          formula_text: string | null
          id: string
          label: string
          lower_is_better: boolean
          metric_group: string
          plain_english: string | null
          responsible_role: string | null
          sort_order: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          formula_text?: string | null
          id: string
          label: string
          lower_is_better?: boolean
          metric_group: string
          plain_english?: string | null
          responsible_role?: string | null
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          formula_text?: string | null
          id?: string
          label?: string
          lower_is_better?: boolean
          metric_group?: string
          plain_english?: string | null
          responsible_role?: string | null
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fin_metric_value: {
        Row: {
          actual_value: number | null
          created_at: string
          id: string
          metric_id: string
          period_id: string
          target_value: number | null
          updated_at: string
        }
        Insert: {
          actual_value?: number | null
          created_at?: string
          id?: string
          metric_id: string
          period_id: string
          target_value?: number | null
          updated_at?: string
        }
        Update: {
          actual_value?: number | null
          created_at?: string
          id?: string
          metric_id?: string
          period_id?: string
          target_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_metric_value_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "fin_metric"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_metric_value_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "fin_period"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_mileage_band: {
        Row: {
          cost_per_mile: number
          created_at: string
          flat_cost: number
          id: string
          label: string | null
          max_miles: number | null
          min_miles: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          cost_per_mile?: number
          created_at?: string
          flat_cost?: number
          id?: string
          label?: string | null
          max_miles?: number | null
          min_miles?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cost_per_mile?: number
          created_at?: string
          flat_cost?: number
          id?: string
          label?: string | null
          max_miles?: number | null
          min_miles?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      fin_period: {
        Row: {
          created_at: string
          fiscal_year: number
          grain: string
          id: string
          is_closed: boolean
          month: number | null
          quarter: number | null
          updated_at: string
          week_start_monday: string | null
        }
        Insert: {
          created_at?: string
          fiscal_year: number
          grain: string
          id?: string
          is_closed?: boolean
          month?: number | null
          quarter?: number | null
          updated_at?: string
          week_start_monday?: string | null
        }
        Update: {
          created_at?: string
          fiscal_year?: number
          grain?: string
          id?: string
          is_closed?: boolean
          month?: number | null
          quarter?: number | null
          updated_at?: string
          week_start_monday?: string | null
        }
        Relationships: []
      }
      fin_product: {
        Row: {
          category: string | null
          created_at: string
          id: string
          infill_type: string | null
          linked_inv_product_id: string | null
          name: string
          raw_cost_per_sqft: number
          roll_size: string | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          infill_type?: string | null
          linked_inv_product_id?: string | null
          name: string
          raw_cost_per_sqft?: number
          roll_size?: string | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          infill_type?: string | null
          linked_inv_product_id?: string | null
          name?: string
          raw_cost_per_sqft?: number
          roll_size?: string | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fin_profit_goal: {
        Row: {
          capex: number
          created_at: string
          current_lt_debt: number
          distributions: number
          fiscal_year: number
          growth: number
          id: string
          taxes: number
          updated_at: string
        }
        Insert: {
          capex?: number
          created_at?: string
          current_lt_debt?: number
          distributions?: number
          fiscal_year: number
          growth?: number
          id?: string
          taxes?: number
          updated_at?: string
        }
        Update: {
          capex?: number
          created_at?: string
          current_lt_debt?: number
          distributions?: number
          fiscal_year?: number
          growth?: number
          id?: string
          taxes?: number
          updated_at?: string
        }
        Relationships: []
      }
      fin_qb_account_map: {
        Row: {
          active: boolean
          created_at: string
          fin_account_id: string
          id: string
          qb_account_id: string | null
          qb_account_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          fin_account_id: string
          id?: string
          qb_account_id?: string | null
          qb_account_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          fin_account_id?: string
          id?: string
          qb_account_id?: string | null
          qb_account_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_qb_account_map_fin_account_id_fkey"
            columns: ["fin_account_id"]
            isOneToOne: false
            referencedRelation: "fin_account"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_recurring_cost: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          frequency: string
          id: string
          last_payment_date: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description: string
          frequency: string
          id?: string
          last_payment_date?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          frequency?: string
          id?: string
          last_payment_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fin_sales_actual: {
        Row: {
          amount: number
          business_unit_id: string
          created_at: string
          fiscal_year: number
          id: string
          month: number
          updated_at: string
        }
        Insert: {
          amount?: number
          business_unit_id: string
          created_at?: string
          fiscal_year: number
          id?: string
          month: number
          updated_at?: string
        }
        Update: {
          amount?: number
          business_unit_id?: string
          created_at?: string
          fiscal_year?: number
          id?: string
          month?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_sales_actual_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "fin_business_unit"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_seasonality: {
        Row: {
          business_unit_id: string
          created_at: string
          history_amount: number
          history_year: number
          id: string
          month: number
          scope: string
          updated_at: string
          year_weight_pct: number
        }
        Insert: {
          business_unit_id: string
          created_at?: string
          history_amount?: number
          history_year: number
          id?: string
          month: number
          scope?: string
          updated_at?: string
          year_weight_pct?: number
        }
        Update: {
          business_unit_id?: string
          created_at?: string
          history_amount?: number
          history_year?: number
          id?: string
          month?: number
          scope?: string
          updated_at?: string
          year_weight_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_seasonality_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "fin_business_unit"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_sync_log: {
        Row: {
          entity: string
          id: string
          message: string | null
          rows_synced: number
          source: string
          status: string
          synced_at: string
        }
        Insert: {
          entity: string
          id?: string
          message?: string | null
          rows_synced?: number
          source?: string
          status?: string
          synced_at?: string
        }
        Update: {
          entity?: string
          id?: string
          message?: string | null
          rows_synced?: number
          source?: string
          status?: string
          synced_at?: string
        }
        Relationships: []
      }
      google_oauth_tokens: {
        Row: {
          access_token: string | null
          expires_at: string | null
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          expires_at?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          expires_at?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_oauth_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_logs: {
        Row: {
          created_at: string
          direction: string
          external_entity_id: string | null
          id: string
          local_entity_id: string
          local_entity_type: string
          message: string | null
          metadata: Json | null
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          direction?: string
          external_entity_id?: string | null
          id?: string
          local_entity_id: string
          local_entity_type: string
          message?: string | null
          metadata?: Json | null
          provider: string
          status: string
        }
        Update: {
          created_at?: string
          direction?: string
          external_entity_id?: string | null
          id?: string
          local_entity_id?: string
          local_entity_type?: string
          message?: string | null
          metadata?: Json | null
          provider?: string
          status?: string
        }
        Relationships: []
      }
      inv_allocations: {
        Row: {
          created_at: string
          dye_lot_preference: string | null
          id: string
          job_id: string
          notes: string | null
          product_id: string | null
          product_name: string | null
          requested_length_ft: number | null
          roll_id: string | null
          status: string
          updated_at: string
          width_ft: number | null
        }
        Insert: {
          created_at?: string
          dye_lot_preference?: string | null
          id?: string
          job_id: string
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          requested_length_ft?: number | null
          roll_id?: string | null
          status?: string
          updated_at?: string
          width_ft?: number | null
        }
        Update: {
          created_at?: string
          dye_lot_preference?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          requested_length_ft?: number | null
          roll_id?: string | null
          status?: string
          updated_at?: string
          width_ft?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_allocations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "inv_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inv_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_allocations_roll_id_fkey"
            columns: ["roll_id"]
            isOneToOne: false
            referencedRelation: "inv_rolls"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_items: {
        Row: {
          active: boolean
          created_at: string
          id: string
          location_id: string | null
          min_quantity: number
          name: string
          notes: string | null
          quantity: number
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          min_quantity?: number
          name: string
          notes?: string | null
          quantity?: number
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          min_quantity?: number
          name?: string
          notes?: string | null
          quantity?: number
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inv_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_jobs: {
        Row: {
          completion_date: string | null
          created_at: string
          created_by: string | null
          id: string
          job_name: string
          job_number: string | null
          notes: string | null
          scheduled_date: string | null
          site_address: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_name: string
          job_number?: string | null
          notes?: string | null
          scheduled_date?: string | null
          site_address?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_name?: string
          job_number?: string | null
          notes?: string | null
          scheduled_date?: string | null
          site_address?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_locations: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      inv_products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          pricing_key: string | null
          sku: string | null
          width_ft: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          pricing_key?: string | null
          sku?: string | null
          width_ft?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          pricing_key?: string | null
          sku?: string | null
          width_ft?: number | null
        }
        Relationships: []
      }
      inv_rolls: {
        Row: {
          allocated_job_id: string | null
          created_at: string
          current_length_ft: number | null
          dye_lot: string | null
          id: string
          location_id: string | null
          manufacturer_roll_number: string | null
          notes: string | null
          original_length_ft: number | null
          parent_roll_id: string | null
          product_id: string | null
          product_name: string | null
          roll_type: Database["public"]["Enums"]["roll_type"]
          status: Database["public"]["Enums"]["roll_status"]
          tt_sku_tag_number: string | null
          updated_at: string
          vendor_id: string | null
          width_ft: number | null
        }
        Insert: {
          allocated_job_id?: string | null
          created_at?: string
          current_length_ft?: number | null
          dye_lot?: string | null
          id?: string
          location_id?: string | null
          manufacturer_roll_number?: string | null
          notes?: string | null
          original_length_ft?: number | null
          parent_roll_id?: string | null
          product_id?: string | null
          product_name?: string | null
          roll_type?: Database["public"]["Enums"]["roll_type"]
          status?: Database["public"]["Enums"]["roll_status"]
          tt_sku_tag_number?: string | null
          updated_at?: string
          vendor_id?: string | null
          width_ft?: number | null
        }
        Update: {
          allocated_job_id?: string | null
          created_at?: string
          current_length_ft?: number | null
          dye_lot?: string | null
          id?: string
          location_id?: string | null
          manufacturer_roll_number?: string | null
          notes?: string | null
          original_length_ft?: number | null
          parent_roll_id?: string | null
          product_id?: string | null
          product_name?: string | null
          roll_type?: Database["public"]["Enums"]["roll_type"]
          status?: Database["public"]["Enums"]["roll_status"]
          tt_sku_tag_number?: string | null
          updated_at?: string
          vendor_id?: string | null
          width_ft?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_rolls_job_fkey"
            columns: ["allocated_job_id"]
            isOneToOne: false
            referencedRelation: "inv_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_rolls_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inv_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_rolls_parent_roll_id_fkey"
            columns: ["parent_roll_id"]
            isOneToOne: false
            referencedRelation: "inv_rolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_rolls_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inv_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_rolls_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json | null
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          from_status: string | null
          id: string
          job_id: string | null
          notes: string | null
          quantity_ft: number | null
          roll_id: string | null
          to_status: string | null
          transaction_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_status?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          quantity_ft?: number | null
          roll_id?: string | null
          to_status?: string | null
          transaction_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_status?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          quantity_ft?: number | null
          roll_id?: string | null
          to_status?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "inv_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_transactions_roll_id_fkey"
            columns: ["roll_id"]
            isOneToOne: false
            referencedRelation: "inv_rolls"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          invoice_id: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          invoice_id: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          invoice_id?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_comments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          category: string | null
          created_at: string
          description: string
          expected_unit_price: number | null
          id: string
          invoice_id: string
          line_total: number
          normalized_description: string | null
          quantity: number | null
          sort_order: number
          unit: string | null
          unit_price: number | null
          variance_amount: number | null
          variance_percent: number | null
          variance_reason: string | null
          variance_status: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          expected_unit_price?: number | null
          id?: string
          invoice_id: string
          line_total?: number
          normalized_description?: string | null
          quantity?: number | null
          sort_order?: number
          unit?: string | null
          unit_price?: number | null
          variance_amount?: number | null
          variance_percent?: number | null
          variance_reason?: string | null
          variance_status?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          expected_unit_price?: number | null
          id?: string
          invoice_id?: string
          line_total?: number
          normalized_description?: string | null
          quantity?: number | null
          sort_order?: number
          unit?: string | null
          unit_price?: number | null
          variance_amount?: number | null
          variance_percent?: number | null
          variance_reason?: string | null
          variance_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_status_history: {
        Row: {
          changed_by_id: string | null
          created_at: string
          id: string
          invoice_id: string
          new_status: Database["public"]["Enums"]["invoice_status"]
          notes: string | null
          notification_sent: boolean
          previous_status: Database["public"]["Enums"]["invoice_status"] | null
        }
        Insert: {
          changed_by_id?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          new_status: Database["public"]["Enums"]["invoice_status"]
          notes?: string | null
          notification_sent?: boolean
          previous_status?: Database["public"]["Enums"]["invoice_status"] | null
        }
        Update: {
          changed_by_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          new_status?: Database["public"]["Enums"]["invoice_status"]
          notes?: string | null
          notification_sent?: boolean
          previous_status?: Database["public"]["Enums"]["invoice_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_status_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_versions: {
        Row: {
          created_at: string
          file_name: string | null
          file_url: string
          id: string
          invoice_id: string
          notes: string | null
          submitted_by_id: string | null
          version_number: number
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_url: string
          id?: string
          invoice_id: string
          notes?: string | null
          submitted_by_id?: string | null
          version_number?: number
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_url?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          submitted_by_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_versions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          admin_notes: string | null
          approval_deadline: string | null
          approved_at: string | null
          approved_by_id: string | null
          archived: boolean
          change_request_reason: string | null
          created_at: string
          currency: string
          customer_name: string | null
          duplicate_warning: boolean
          id: string
          invoice_date: string | null
          invoice_number: string | null
          job_name: string | null
          jobber_url: string | null
          monday_board_id: string | null
          monday_item_id: string | null
          ocr_confidence: number | null
          ocr_reviewed: boolean
          ocr_text: string | null
          original_file_name: string | null
          original_file_type: string | null
          original_file_url: string | null
          ownership_notes: string | null
          paid_at: string | null
          paid_by_id: string | null
          payment_method: string | null
          payment_notes: string | null
          payment_reference: string | null
          project_id: string | null
          reviewed_at: string | null
          reviewed_by_id: string | null
          service_period_end: string | null
          service_period_start: string | null
          slack_thread_ts: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          status_changed_at: string
          submitted_at: string
          submitted_by_id: string
          subtotal: number | null
          tax: number | null
          title: string
          total_amount: number | null
          updated_at: string
          variance_notes: string | null
          vendor_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          approval_deadline?: string | null
          approved_at?: string | null
          approved_by_id?: string | null
          archived?: boolean
          change_request_reason?: string | null
          created_at?: string
          currency?: string
          customer_name?: string | null
          duplicate_warning?: boolean
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          job_name?: string | null
          jobber_url?: string | null
          monday_board_id?: string | null
          monday_item_id?: string | null
          ocr_confidence?: number | null
          ocr_reviewed?: boolean
          ocr_text?: string | null
          original_file_name?: string | null
          original_file_type?: string | null
          original_file_url?: string | null
          ownership_notes?: string | null
          paid_at?: string | null
          paid_by_id?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_reference?: string | null
          project_id?: string | null
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          slack_thread_ts?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          status_changed_at?: string
          submitted_at?: string
          submitted_by_id: string
          subtotal?: number | null
          tax?: number | null
          title: string
          total_amount?: number | null
          updated_at?: string
          variance_notes?: string | null
          vendor_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          approval_deadline?: string | null
          approved_at?: string | null
          approved_by_id?: string | null
          archived?: boolean
          change_request_reason?: string | null
          created_at?: string
          currency?: string
          customer_name?: string | null
          duplicate_warning?: boolean
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          job_name?: string | null
          jobber_url?: string | null
          monday_board_id?: string | null
          monday_item_id?: string | null
          ocr_confidence?: number | null
          ocr_reviewed?: boolean
          ocr_text?: string | null
          original_file_name?: string | null
          original_file_type?: string | null
          original_file_url?: string | null
          ownership_notes?: string | null
          paid_at?: string | null
          paid_by_id?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_reference?: string | null
          project_id?: string | null
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          slack_thread_ts?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          status_changed_at?: string
          submitted_at?: string
          submitted_by_id?: string
          subtotal?: number | null
          tax?: number | null
          title?: string
          total_amount?: number | null
          updated_at?: string
          variance_notes?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      job_progress_events: {
        Row: {
          id: string
          jobber_visit_id: string | null
          notes: string | null
          pull_list_id: string | null
          recorded_at: string
          recorded_by_profile: string | null
          state: Database["public"]["Enums"]["job_progress_state"]
        }
        Insert: {
          id?: string
          jobber_visit_id?: string | null
          notes?: string | null
          pull_list_id?: string | null
          recorded_at?: string
          recorded_by_profile?: string | null
          state: Database["public"]["Enums"]["job_progress_state"]
        }
        Update: {
          id?: string
          jobber_visit_id?: string | null
          notes?: string | null
          pull_list_id?: string | null
          recorded_at?: string
          recorded_by_profile?: string | null
          state?: Database["public"]["Enums"]["job_progress_state"]
        }
        Relationships: [
          {
            foreignKeyName: "job_progress_events_jobber_visit_id_fkey"
            columns: ["jobber_visit_id"]
            isOneToOne: false
            referencedRelation: "jobber_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_progress_events_pull_list_id_fkey"
            columns: ["pull_list_id"]
            isOneToOne: false
            referencedRelation: "warehouse_pull_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_progress_events_recorded_by_profile_fkey"
            columns: ["recorded_by_profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobber_clients: {
        Row: {
          balance_cents: number | null
          company_name: string | null
          emails: Json
          first_name: string | null
          id: string
          is_archived: boolean
          jobber_account_id: string
          jobber_created_at: string | null
          jobber_updated_at: string | null
          last_name: string | null
          phones: Json
          raw: Json | null
          slack_channel_id: string | null
          synced_at: string
        }
        Insert: {
          balance_cents?: number | null
          company_name?: string | null
          emails?: Json
          first_name?: string | null
          id: string
          is_archived?: boolean
          jobber_account_id: string
          jobber_created_at?: string | null
          jobber_updated_at?: string | null
          last_name?: string | null
          phones?: Json
          raw?: Json | null
          slack_channel_id?: string | null
          synced_at?: string
        }
        Update: {
          balance_cents?: number | null
          company_name?: string | null
          emails?: Json
          first_name?: string | null
          id?: string
          is_archived?: boolean
          jobber_account_id?: string
          jobber_created_at?: string | null
          jobber_updated_at?: string | null
          last_name?: string | null
          phones?: Json
          raw?: Json | null
          slack_channel_id?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobber_clients_jobber_account_id_fkey"
            columns: ["jobber_account_id"]
            isOneToOne: false
            referencedRelation: "jobber_oauth_tokens"
            referencedColumns: ["jobber_account_id"]
          },
        ]
      }
      jobber_jobs: {
        Row: {
          client_id: string | null
          completed_at: string | null
          end_at: string | null
          id: string
          job_number: string | null
          jobber_account_id: string
          jobber_created_at: string | null
          jobber_updated_at: string | null
          property_id: string | null
          raw: Json | null
          start_at: string | null
          status: string | null
          synced_at: string
          title: string | null
          total_cents: number | null
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          end_at?: string | null
          id: string
          job_number?: string | null
          jobber_account_id: string
          jobber_created_at?: string | null
          jobber_updated_at?: string | null
          property_id?: string | null
          raw?: Json | null
          start_at?: string | null
          status?: string | null
          synced_at?: string
          title?: string | null
          total_cents?: number | null
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          end_at?: string | null
          id?: string
          job_number?: string | null
          jobber_account_id?: string
          jobber_created_at?: string | null
          jobber_updated_at?: string | null
          property_id?: string | null
          raw?: Json | null
          start_at?: string | null
          status?: string | null
          synced_at?: string
          title?: string | null
          total_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobber_jobs_jobber_account_id_fkey"
            columns: ["jobber_account_id"]
            isOneToOne: false
            referencedRelation: "jobber_oauth_tokens"
            referencedColumns: ["jobber_account_id"]
          },
        ]
      }
      jobber_oauth_tokens: {
        Row: {
          access_token: string
          expires_at: string
          installed_at: string
          jobber_account_id: string
          refresh_token: string
          scopes: string[]
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at: string
          installed_at?: string
          jobber_account_id: string
          refresh_token: string
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          installed_at?: string
          jobber_account_id?: string
          refresh_token?: string
          scopes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      jobber_visits: {
        Row: {
          assigned_user_ids: string[]
          client_id: string | null
          ends_at: string | null
          id: string
          is_complete: boolean
          job_id: string | null
          jobber_account_id: string
          property_id: string | null
          raw: Json | null
          starts_at: string | null
          synced_at: string
          title: string | null
        }
        Insert: {
          assigned_user_ids?: string[]
          client_id?: string | null
          ends_at?: string | null
          id: string
          is_complete?: boolean
          job_id?: string | null
          jobber_account_id: string
          property_id?: string | null
          raw?: Json | null
          starts_at?: string | null
          synced_at?: string
          title?: string | null
        }
        Update: {
          assigned_user_ids?: string[]
          client_id?: string | null
          ends_at?: string | null
          id?: string
          is_complete?: boolean
          job_id?: string | null
          jobber_account_id?: string
          property_id?: string | null
          raw?: Json | null
          starts_at?: string | null
          synced_at?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobber_visits_jobber_account_id_fkey"
            columns: ["jobber_account_id"]
            isOneToOne: false
            referencedRelation: "jobber_oauth_tokens"
            referencedColumns: ["jobber_account_id"]
          },
        ]
      }
      jobber_webhook_events: {
        Row: {
          hmac_valid: boolean
          id: string
          item_id: string | null
          jobber_account_id: string | null
          occured_at: string | null
          process_error: string | null
          processed_at: string | null
          raw: Json
          received_at: string
          topic: string
        }
        Insert: {
          hmac_valid: boolean
          id?: string
          item_id?: string | null
          jobber_account_id?: string | null
          occured_at?: string | null
          process_error?: string | null
          processed_at?: string | null
          raw: Json
          received_at?: string
          topic: string
        }
        Update: {
          hmac_valid?: boolean
          id?: string
          item_id?: string | null
          jobber_account_id?: string | null
          occured_at?: string | null
          process_error?: string | null
          processed_at?: string | null
          raw?: Json
          received_at?: string
          topic?: string
        }
        Relationships: []
      }
      kpi_entries: {
        Row: {
          actual_value: number | null
          created_at: string | null
          created_by: string | null
          id: string
          kpi_key: string
          kpi_label: string
          notes: string | null
          period_month: number
          period_year: number
          target_value: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          actual_value?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kpi_key: string
          kpi_label: string
          notes?: string | null
          period_month: number
          period_year: number
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_value?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kpi_key?: string
          kpi_label?: string
          notes?: string | null
          period_month?: number
          period_year?: number
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_log_entries: {
        Row: {
          created_at: string
          created_by: string
          entry_date: string
          id: string
          mgmt_notes: string | null
          mgmt_signed_at: string | null
          mgmt_signed_by: string | null
          notes: string | null
          pass_fail: string
          payload: Json
          section_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          entry_date?: string
          id?: string
          mgmt_notes?: string | null
          mgmt_signed_at?: string | null
          mgmt_signed_by?: string | null
          notes?: string | null
          pass_fail?: string
          payload?: Json
          section_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          entry_date?: string
          id?: string
          mgmt_notes?: string | null
          mgmt_signed_at?: string | null
          mgmt_signed_by?: string | null
          notes?: string | null
          pass_fail?: string
          payload?: Json
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_log_entries_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "kpi_log_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_log_sections: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          targets: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          sort_order: number
          targets?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          targets?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          asset_id: string
          cost_cents: number
          created_at: string
          description: string
          id: string
          invoice_url: string | null
          meter_value: number | null
          notes: string | null
          performed_at: string
          performed_by_profile: string | null
          performed_by_vendor: string | null
          schedule_id: string | null
          vendor: string | null
        }
        Insert: {
          asset_id: string
          cost_cents?: number
          created_at?: string
          description: string
          id?: string
          invoice_url?: string | null
          meter_value?: number | null
          notes?: string | null
          performed_at?: string
          performed_by_profile?: string | null
          performed_by_vendor?: string | null
          schedule_id?: string | null
          vendor?: string | null
        }
        Update: {
          asset_id?: string
          cost_cents?: number
          created_at?: string
          description?: string
          id?: string
          invoice_url?: string | null
          meter_value?: number | null
          notes?: string | null
          performed_at?: string
          performed_by_profile?: string | null
          performed_by_vendor?: string | null
          schedule_id?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_performed_by_profile_fkey"
            columns: ["performed_by_profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          active: boolean
          asset_id: string
          created_at: string
          id: string
          interval_type: Database["public"]["Enums"]["maintenance_interval_type"]
          interval_value: number
          last_serviced_at: string | null
          last_serviced_meter: number | null
          name: string
          next_due_at: string | null
          next_due_meter: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_id: string
          created_at?: string
          id?: string
          interval_type: Database["public"]["Enums"]["maintenance_interval_type"]
          interval_value: number
          last_serviced_at?: string | null
          last_serviced_meter?: number | null
          name: string
          next_due_at?: string | null
          next_due_meter?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_id?: string
          created_at?: string
          id?: string
          interval_type?: Database["public"]["Enums"]["maintenance_interval_type"]
          interval_value?: number
          last_serviced_at?: string | null
          last_serviced_meter?: number | null
          name?: string
          next_due_at?: string | null
          next_due_meter?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_items: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          due_date: string | null
          id: string
          meeting_id: string
          occurs_on: string
          owner_id: string | null
          section_key: string
          status: Database["public"]["Enums"]["meeting_item_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id: string
          occurs_on: string
          owner_id?: string | null
          section_key: string
          status?: Database["public"]["Enums"]["meeting_item_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          occurs_on?: string
          owner_id?: string | null
          section_key?: string
          status?: Database["public"]["Enums"]["meeting_item_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_items_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          allowed_departments: Database["public"]["Enums"]["user_department"][]
          allowed_roles: Database["public"]["Enums"]["user_role"][]
          archived: boolean
          cadence: Database["public"]["Enums"]["meeting_cadence"]
          created_at: string
          created_by: string | null
          day_of_month: number | null
          day_of_week: number | null
          description: string | null
          duration_min: number | null
          gcal_event_id: string | null
          id: string
          invited_user_ids: string[]
          meet_url: string | null
          name: string
          scheduled_on: string | null
          sections: Json
          slug: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          allowed_departments?: Database["public"]["Enums"]["user_department"][]
          allowed_roles?: Database["public"]["Enums"]["user_role"][]
          archived?: boolean
          cadence?: Database["public"]["Enums"]["meeting_cadence"]
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          duration_min?: number | null
          gcal_event_id?: string | null
          id?: string
          invited_user_ids?: string[]
          meet_url?: string | null
          name: string
          scheduled_on?: string | null
          sections?: Json
          slug: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          allowed_departments?: Database["public"]["Enums"]["user_department"][]
          allowed_roles?: Database["public"]["Enums"]["user_role"][]
          archived?: boolean
          cadence?: Database["public"]["Enums"]["meeting_cadence"]
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          duration_min?: number | null
          gcal_event_id?: string | null
          id?: string
          invited_user_ids?: string[]
          meet_url?: string | null
          name?: string
          scheduled_on?: string | null
          sections?: Json
          slug?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          id: string
          read: boolean
          resource_id: string | null
          resource_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          resource_id?: string | null
          resource_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          resource_id?: string | null
          resource_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      ocr_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          invoice_id: string
          provider: string
          raw_response: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id: string
          provider?: string
          raw_response?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string
          provider?: string
          raw_response?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_jobs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_addons: {
        Row: {
          cost: number
          created_at: string
          id: string
          kind: string
          label: string
          qty: number
          session_id: string
          sort: number
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          kind?: string
          label: string
          qty?: number
          session_id: string
          sort?: number
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          kind?: string
          label?: string
          qty?: number
          session_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "pitch_addons_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pitch_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_areas: {
        Row: {
          access: string
          application: string
          created_at: string
          edgings: Json
          extras: Json
          id: string
          infill_product: string | null
          installed_sqft: number
          label: string
          notes: string | null
          product: string
          session_id: string
          sort: number
          target_margin: number | null
          tearout_tier: string
          tier_key: string | null
          updated_at: string
        }
        Insert: {
          access?: string
          application?: string
          created_at?: string
          edgings?: Json
          extras?: Json
          id?: string
          infill_product?: string | null
          installed_sqft?: number
          label: string
          notes?: string | null
          product: string
          session_id: string
          sort?: number
          target_margin?: number | null
          tearout_tier?: string
          tier_key?: string | null
          updated_at?: string
        }
        Update: {
          access?: string
          application?: string
          created_at?: string
          edgings?: Json
          extras?: Json
          id?: string
          infill_product?: string | null
          installed_sqft?: number
          label?: string
          notes?: string | null
          product?: string
          session_id?: string
          sort?: number
          target_margin?: number | null
          tearout_tier?: string
          tier_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitch_areas_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pitch_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_decks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          service_line: string | null
          slides: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          service_line?: string | null
          slides?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          service_line?: string | null
          slides?: Json
          updated_at?: string
        }
        Relationships: []
      }
      pitch_photos: {
        Row: {
          area_id: string | null
          category: string
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          path: string
          session_id: string
          sort: number
        }
        Insert: {
          area_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          path: string
          session_id: string
          sort?: number
        }
        Update: {
          area_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          path?: string
          session_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "pitch_photos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "pitch_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_photos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pitch_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_sessions: {
        Row: {
          address: string | null
          base_job: Json
          client_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          decided_at: string | null
          deck_id: string | null
          documented_at: string | null
          explored_at: string | null
          id: string
          kiosk_pin_hash: string | null
          presented_at: string | null
          prospect_name: string | null
          quote_snapshot: Json
          quote_total: number | null
          quote_v2: Json
          quoted_at: string | null
          selected_tier: string | null
          share_enabled: boolean
          share_expires_at: string | null
          share_token: string | null
          shared_at: string | null
          status: string
          tier_snapshot: Json
          updated_at: string
        }
        Insert: {
          address?: string | null
          base_job: Json
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          decided_at?: string | null
          deck_id?: string | null
          documented_at?: string | null
          explored_at?: string | null
          id?: string
          kiosk_pin_hash?: string | null
          presented_at?: string | null
          prospect_name?: string | null
          quote_snapshot?: Json
          quote_total?: number | null
          quote_v2?: Json
          quoted_at?: string | null
          selected_tier?: string | null
          share_enabled?: boolean
          share_expires_at?: string | null
          share_token?: string | null
          shared_at?: string | null
          status?: string
          tier_snapshot?: Json
          updated_at?: string
        }
        Update: {
          address?: string | null
          base_job?: Json
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          decided_at?: string | null
          deck_id?: string | null
          documented_at?: string | null
          explored_at?: string | null
          id?: string
          kiosk_pin_hash?: string | null
          presented_at?: string | null
          prospect_name?: string | null
          quote_snapshot?: Json
          quote_total?: number | null
          quote_v2?: Json
          quoted_at?: string | null
          selected_tier?: string | null
          share_enabled?: boolean
          share_expires_at?: string | null
          share_token?: string | null
          shared_at?: string | null
          status?: string
          tier_snapshot?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitch_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "jobber_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_sessions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_sessions_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "pitch_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_site_docs: {
        Row: {
          conditions: Json
          session_id: string
          updated_at: string
          updated_by: string | null
          use_notes: Json
        }
        Insert: {
          conditions?: Json
          session_id: string
          updated_at?: string
          updated_by?: string | null
          use_notes?: Json
        }
        Update: {
          conditions?: Json
          session_id?: string
          updated_at?: string
          updated_by?: string | null
          use_notes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pitch_site_docs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "pitch_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_tiers: {
        Row: {
          id: string
          inclusions: Json
          infill_mode: string
          inv_product_id: string | null
          is_active: boolean
          key: string
          name: string
          pricing_key: string
          product_label: string
          sort: number
          target_margin: number
          updated_at: string
          updated_by: string | null
          warranty: Json
        }
        Insert: {
          id?: string
          inclusions?: Json
          infill_mode?: string
          inv_product_id?: string | null
          is_active?: boolean
          key: string
          name: string
          pricing_key: string
          product_label: string
          sort?: number
          target_margin?: number
          updated_at?: string
          updated_by?: string | null
          warranty?: Json
        }
        Update: {
          id?: string
          inclusions?: Json
          infill_mode?: string
          inv_product_id?: string | null
          is_active?: boolean
          key?: string
          name?: string
          pricing_key?: string
          product_label?: string
          sort?: number
          target_margin?: number
          updated_at?: string
          updated_by?: string | null
          warranty?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pitch_tiers_inv_product_id_fkey"
            columns: ["inv_product_id"]
            isOneToOne: false
            referencedRelation: "inv_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: Database["public"]["Enums"]["user_department"] | null
          department_id: string | null
          departments: Database["public"]["Enums"]["user_department"][]
          email: string
          full_name: string | null
          google_access_token: string | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          id: string
          mobile: string | null
          role: Database["public"]["Enums"]["user_role"]
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["user_department"] | null
          department_id?: string | null
          departments?: Database["public"]["Enums"]["user_department"][]
          email: string
          full_name?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id: string
          mobile?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["user_department"] | null
          department_id?: string | null
          departments?: Database["public"]["Enums"]["user_department"][]
          email?: string
          full_name?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          mobile?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          added_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          archived: boolean
          created_at: string
          created_by_id: string
          customer_name: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
          id: string
          jobber_job_id: string | null
          jobber_url: string | null
          monday_item_id: string | null
          name: string
          owner_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          slack_channel_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          target_install_date: string | null
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived?: boolean
          created_at?: string
          created_by_id: string
          customer_name?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          jobber_job_id?: string | null
          jobber_url?: string | null
          monday_item_id?: string | null
          name: string
          owner_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          slack_channel_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          target_install_date?: string | null
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived?: boolean
          created_at?: string
          created_by_id?: string
          customer_name?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          jobber_job_id?: string | null
          jobber_url?: string | null
          monday_item_id?: string | null
          name?: string
          owner_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          slack_channel_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          target_install_date?: string | null
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_events: {
        Row: {
          changed_by_id: string | null
          created_at: string
          event_type: string
          id: string
          new_status: Database["public"]["Enums"]["po_status"] | null
          notes: string | null
          previous_status: Database["public"]["Enums"]["po_status"] | null
          purchase_order_id: string
          source: string
        }
        Insert: {
          changed_by_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_status?: Database["public"]["Enums"]["po_status"] | null
          notes?: string | null
          previous_status?: Database["public"]["Enums"]["po_status"] | null
          purchase_order_id: string
          source?: string
        }
        Update: {
          changed_by_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_status?: Database["public"]["Enums"]["po_status"] | null
          notes?: string | null
          previous_status?: Database["public"]["Enums"]["po_status"] | null
          purchase_order_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_events_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          assigned_buyer_id: string | null
          carrier: string | null
          created_at: string
          created_by_id: string | null
          damage_notes: string | null
          damage_reported: boolean
          deposit_amount: number | null
          deposit_paid_date: string | null
          deposit_required: boolean
          documents: Json
          estimated_cost: number | null
          eta: string | null
          expected_delivery_date: string | null
          final_order_amount: number | null
          id: string
          inventory_item_id: string | null
          invoice_date: string | null
          invoice_id: string | null
          job_name: string | null
          material_needed: string | null
          needed_by: string | null
          notes: string | null
          order_date: string | null
          payment_due_date: string | null
          payment_status: Database["public"]["Enums"]["po_payment_status"]
          payment_terms: Database["public"]["Enums"]["po_payment_terms"] | null
          po_number: string | null
          priority: Database["public"]["Enums"]["po_priority"]
          project_id: string | null
          purchase_type: Database["public"]["Enums"]["po_purchase_type"]
          quantity_needed: string | null
          quantity_received: string | null
          quote_amount: number | null
          received_by: string | null
          remaining_balance: number | null
          request_date: string
          request_description: string
          requested_by: string | null
          requested_by_id: string | null
          seq: number
          shortage_notes: string | null
          shortages_reported: boolean
          slack_channel_id: string | null
          slack_message_ts: string | null
          slack_thread_ts: string | null
          status: Database["public"]["Enums"]["po_status"]
          status_changed_at: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          vendor_contact: string | null
          vendor_id: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          assigned_buyer_id?: string | null
          carrier?: string | null
          created_at?: string
          created_by_id?: string | null
          damage_notes?: string | null
          damage_reported?: boolean
          deposit_amount?: number | null
          deposit_paid_date?: string | null
          deposit_required?: boolean
          documents?: Json
          estimated_cost?: number | null
          eta?: string | null
          expected_delivery_date?: string | null
          final_order_amount?: number | null
          id?: string
          inventory_item_id?: string | null
          invoice_date?: string | null
          invoice_id?: string | null
          job_name?: string | null
          material_needed?: string | null
          needed_by?: string | null
          notes?: string | null
          order_date?: string | null
          payment_due_date?: string | null
          payment_status?: Database["public"]["Enums"]["po_payment_status"]
          payment_terms?: Database["public"]["Enums"]["po_payment_terms"] | null
          po_number?: string | null
          priority?: Database["public"]["Enums"]["po_priority"]
          project_id?: string | null
          purchase_type?: Database["public"]["Enums"]["po_purchase_type"]
          quantity_needed?: string | null
          quantity_received?: string | null
          quote_amount?: number | null
          received_by?: string | null
          remaining_balance?: number | null
          request_date?: string
          request_description: string
          requested_by?: string | null
          requested_by_id?: string | null
          seq?: never
          shortage_notes?: string | null
          shortages_reported?: boolean
          slack_channel_id?: string | null
          slack_message_ts?: string | null
          slack_thread_ts?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          status_changed_at?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_contact?: string | null
          vendor_id?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          assigned_buyer_id?: string | null
          carrier?: string | null
          created_at?: string
          created_by_id?: string | null
          damage_notes?: string | null
          damage_reported?: boolean
          deposit_amount?: number | null
          deposit_paid_date?: string | null
          deposit_required?: boolean
          documents?: Json
          estimated_cost?: number | null
          eta?: string | null
          expected_delivery_date?: string | null
          final_order_amount?: number | null
          id?: string
          inventory_item_id?: string | null
          invoice_date?: string | null
          invoice_id?: string | null
          job_name?: string | null
          material_needed?: string | null
          needed_by?: string | null
          notes?: string | null
          order_date?: string | null
          payment_due_date?: string | null
          payment_status?: Database["public"]["Enums"]["po_payment_status"]
          payment_terms?: Database["public"]["Enums"]["po_payment_terms"] | null
          po_number?: string | null
          priority?: Database["public"]["Enums"]["po_priority"]
          project_id?: string | null
          purchase_type?: Database["public"]["Enums"]["po_purchase_type"]
          quantity_needed?: string | null
          quantity_received?: string | null
          quote_amount?: number | null
          received_by?: string | null
          remaining_balance?: number | null
          request_date?: string
          request_description?: string
          requested_by?: string | null
          requested_by_id?: string | null
          seq?: never
          shortage_notes?: string | null
          shortages_reported?: boolean
          slack_channel_id?: string | null
          slack_message_ts?: string | null
          slack_thread_ts?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          status_changed_at?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_contact?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          active: boolean
          assignee_id: string
          created_at: string
          created_by_id: string
          day_of_month: number | null
          day_of_week: number | null
          department_id: string | null
          description: string | null
          freq: Database["public"]["Enums"]["recurrence_freq"]
          id: string
          last_generated: string | null
          lead_days: number
          next_due: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["task_visibility"]
        }
        Insert: {
          active?: boolean
          assignee_id: string
          created_at?: string
          created_by_id: string
          day_of_month?: number | null
          day_of_week?: number | null
          department_id?: string | null
          description?: string | null
          freq?: Database["public"]["Enums"]["recurrence_freq"]
          id?: string
          last_generated?: string | null
          lead_days?: number
          next_due?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["task_visibility"]
        }
        Update: {
          active?: boolean
          assignee_id?: string
          created_at?: string
          created_by_id?: string
          day_of_month?: number | null
          day_of_week?: number | null
          department_id?: string | null
          description?: string | null
          freq?: Database["public"]["Enums"]["recurrence_freq"]
          id?: string
          last_generated?: string | null
          lead_days?: number
          next_due?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["task_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_outreach: {
        Row: {
          attempts: number
          call_status: Database["public"]["Enums"]["outreach_call_status"]
          campaign_id: string
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          id: string
          jobber_client_id: string
          last_called_at: string | null
          last_job_note: string | null
          notes: string | null
          owner_id: string | null
          segment: Database["public"]["Enums"]["outreach_segment"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          call_status?: Database["public"]["Enums"]["outreach_call_status"]
          campaign_id: string
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          id?: string
          jobber_client_id: string
          last_called_at?: string | null
          last_job_note?: string | null
          notes?: string | null
          owner_id?: string | null
          segment?: Database["public"]["Enums"]["outreach_segment"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          call_status?: Database["public"]["Enums"]["outreach_call_status"]
          campaign_id?: string
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          id?: string
          jobber_client_id?: string
          last_called_at?: string | null
          last_job_note?: string | null
          notes?: string | null
          owner_id?: string | null
          segment?: Database["public"]["Enums"]["outreach_segment"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_outreach_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_outreach_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by_id: string | null
          id: string
          jobber_job_url: string | null
          jobber_quote_url: string | null
          notes: string | null
          outreach_id: string | null
          referred_email: string | null
          referred_name: string
          referred_phone: string | null
          referrer_jobber_client_id: string | null
          referrer_name: string
          reward_note: string | null
          reward_sent_at: string | null
          reward_status: Database["public"]["Enums"]["referral_reward_status"]
          reward_type: Database["public"]["Enums"]["referral_reward_type"]
          service_interest: string | null
          source: Database["public"]["Enums"]["referral_source"]
          stage: Database["public"]["Enums"]["referral_stage"]
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by_id?: string | null
          id?: string
          jobber_job_url?: string | null
          jobber_quote_url?: string | null
          notes?: string | null
          outreach_id?: string | null
          referred_email?: string | null
          referred_name: string
          referred_phone?: string | null
          referrer_jobber_client_id?: string | null
          referrer_name: string
          reward_note?: string | null
          reward_sent_at?: string | null
          reward_status?: Database["public"]["Enums"]["referral_reward_status"]
          reward_type?: Database["public"]["Enums"]["referral_reward_type"]
          service_interest?: string | null
          source?: Database["public"]["Enums"]["referral_source"]
          stage?: Database["public"]["Enums"]["referral_stage"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by_id?: string | null
          id?: string
          jobber_job_url?: string | null
          jobber_quote_url?: string | null
          notes?: string | null
          outreach_id?: string | null
          referred_email?: string | null
          referred_name?: string
          referred_phone?: string | null
          referrer_jobber_client_id?: string | null
          referrer_name?: string
          reward_note?: string | null
          reward_sent_at?: string | null
          reward_status?: Database["public"]["Enums"]["referral_reward_status"]
          reward_type?: Database["public"]["Enums"]["referral_reward_type"]
          service_interest?: string | null
          source?: Database["public"]["Enums"]["referral_source"]
          stage?: Database["public"]["Enums"]["referral_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "referral_outreach"
            referencedColumns: ["id"]
          },
        ]
      }
      review_outreach: {
        Row: {
          client_email: string | null
          client_name: string
          client_phone: string | null
          completed_on: string | null
          created_at: string
          id: string
          job_title: string | null
          jobber_client_id: string | null
          jobber_job_id: string
          notes: string | null
          owner_id: string | null
          platform: Database["public"]["Enums"]["review_platform"] | null
          received_at: string | null
          requested_at: string | null
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
        }
        Insert: {
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          completed_on?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          jobber_client_id?: string | null
          jobber_job_id: string
          notes?: string | null
          owner_id?: string | null
          platform?: Database["public"]["Enums"]["review_platform"] | null
          received_at?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Update: {
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          completed_on?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          jobber_client_id?: string | null
          jobber_job_id?: string
          notes?: string | null
          owner_id?: string | null
          platform?: Database["public"]["Enums"]["review_platform"] | null
          received_at?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_outreach_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_contacts: {
        Row: {
          city: string | null
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          jobber_client_id: string | null
          name: string
          notes: string | null
          phone: string | null
          segment: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          jobber_client_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          segment?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          jobber_client_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          segment?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_contacts_jobber_client_id_fkey"
            columns: ["jobber_client_id"]
            isOneToOne: false
            referencedRelation: "jobber_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          task_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          task_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          added_at: string
          added_by: string | null
          is_primary: boolean
          profile_id: string
          task_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          is_primary?: boolean
          profile_id: string
          task_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          is_primary?: boolean
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          mentions: string[]
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mentions?: string[]
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mentions?: string[]
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string
          blocked_reason: string | null
          completed_at: string | null
          created_at: string
          created_by_id: string
          department_id: string | null
          description: string | null
          due_date: string | null
          id: string
          monday_item_id: string | null
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          recurring_rule_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["task_visibility"]
        }
        Insert: {
          assignee_id: string
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_id: string
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          monday_item_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          recurring_rule_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["task_visibility"]
        }
        Update: {
          assignee_id?: string
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_id?: string
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          monday_item_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          recurring_rule_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["task_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      team_kpi_definitions: {
        Row: {
          created_at: string | null
          id: string
          kpi_key: string
          kpi_label: string
          lower_is_better: boolean | null
          target_value: number
          team_member_id: string
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          kpi_key: string
          kpi_label: string
          lower_is_better?: boolean | null
          target_value: number
          team_member_id: string
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          kpi_key?: string
          kpi_label?: string
          lower_is_better?: boolean | null
          target_value?: number
          team_member_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_kpi_definitions_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_kpi_entries: {
        Row: {
          actual_value: number | null
          created_at: string | null
          created_by: string | null
          id: string
          kpi_key: string
          notes: string | null
          period_month: number
          period_year: number
          team_member_id: string
          updated_at: string | null
        }
        Insert: {
          actual_value?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kpi_key: string
          notes?: string | null
          period_month: number
          period_year: number
          team_member_id: string
          updated_at?: string | null
        }
        Update: {
          actual_value?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kpi_key?: string
          notes?: string | null
          period_month?: number
          period_year?: number
          team_member_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_kpi_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_kpi_entries_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean | null
          created_at: string | null
          department: string | null
          full_name: string
          id: string
          profile_id: string | null
          role_title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          department?: string | null
          full_name: string
          id?: string
          profile_id?: string | null
          role_title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          department?: string | null
          full_name?: string
          id?: string
          profile_id?: string | null
          role_title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unmatched_calls: {
        Row: {
          duration_sec: number | null
          from_number: string
          id: string
          occurred_at: string
          recording_sid: string | null
          recording_url: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          transcript: string | null
        }
        Insert: {
          duration_sec?: number | null
          from_number: string
          id?: string
          occurred_at?: string
          recording_sid?: string | null
          recording_url?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          transcript?: string | null
        }
        Update: {
          duration_sec?: number | null
          from_number?: string
          id?: string
          occurred_at?: string
          recording_sid?: string | null
          recording_url?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          transcript?: string | null
        }
        Relationships: []
      }
      vehicle_reservations: {
        Row: {
          asset_id: string
          created_at: string
          created_by: string | null
          destination: string | null
          driver_id: string
          ends_at: string
          id: string
          notes: string | null
          purpose: string
          starts_at: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          driver_id: string
          ends_at: string
          id?: string
          notes?: string | null
          purpose: string
          starts_at: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          driver_id?: string
          ends_at?: string
          id?: string
          notes?: string | null
          purpose?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_reservations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_reservations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          active: boolean
          address: string | null
          contact_name: string | null
          created_at: string
          created_by_id: string | null
          default_rates: Json | null
          email: string | null
          id: string
          monday_item_id: string | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          type: Database["public"]["Enums"]["vendor_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          created_at?: string
          created_by_id?: string | null
          default_rates?: Json | null
          email?: string | null
          id?: string
          monday_item_id?: string | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["vendor_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          created_at?: string
          created_by_id?: string | null
          default_rates?: Json | null
          email?: string | null
          id?: string
          monday_item_id?: string | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["vendor_type"]
          updated_at?: string
        }
        Relationships: []
      }
      warehouse_budgets: {
        Row: {
          amount_cents: number
          asset_id: string | null
          created_at: string
          id: string
          kind: string
          notes: string | null
          period_end: string
          period_start: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          asset_id?: string | null
          created_at?: string
          id?: string
          kind: string
          notes?: string | null
          period_end: string
          period_start: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          asset_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_budgets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_deliveries: {
        Row: {
          address: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          created_by_profile: string | null
          delivered_at: string
          id: string
          jobber_visit_id: string | null
          materials: Json
          notes: string | null
          photo_url: string | null
          pull_list_id: string | null
          received_by: string | null
          received_by_employee_id: string | null
          slack_channel: string | null
          slack_message_ts: string | null
          slack_posted_at: string | null
          staging_location: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by_profile?: string | null
          delivered_at?: string
          id?: string
          jobber_visit_id?: string | null
          materials?: Json
          notes?: string | null
          photo_url?: string | null
          pull_list_id?: string | null
          received_by?: string | null
          received_by_employee_id?: string | null
          slack_channel?: string | null
          slack_message_ts?: string | null
          slack_posted_at?: string | null
          staging_location?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by_profile?: string | null
          delivered_at?: string
          id?: string
          jobber_visit_id?: string | null
          materials?: Json
          notes?: string | null
          photo_url?: string | null
          pull_list_id?: string | null
          received_by?: string | null
          received_by_employee_id?: string | null
          slack_channel?: string | null
          slack_message_ts?: string | null
          slack_posted_at?: string | null
          staging_location?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_deliveries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "jobber_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_deliveries_created_by_profile_fkey"
            columns: ["created_by_profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_deliveries_jobber_visit_id_fkey"
            columns: ["jobber_visit_id"]
            isOneToOne: false
            referencedRelation: "jobber_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_deliveries_pull_list_id_fkey"
            columns: ["pull_list_id"]
            isOneToOne: false
            referencedRelation: "warehouse_pull_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_deliveries_received_by_employee_id_fkey"
            columns: ["received_by_employee_id"]
            isOneToOne: false
            referencedRelation: "warehouse_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_employees: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          job_role: string | null
          last_name: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          job_role?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          job_role?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_inspections: {
        Row: {
          created_at: string
          equipment_id: string | null
          failure_notes: string | null
          id: string
          inspected_at: string
          inspector: string
          inspector_employee_id: string | null
          items: Json
          photos: Json
          pull_list_id: string | null
          result: string
          trailer_id: string | null
          truck_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          equipment_id?: string | null
          failure_notes?: string | null
          id?: string
          inspected_at?: string
          inspector: string
          inspector_employee_id?: string | null
          items?: Json
          photos?: Json
          pull_list_id?: string | null
          result: string
          trailer_id?: string | null
          truck_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          equipment_id?: string | null
          failure_notes?: string | null
          id?: string
          inspected_at?: string
          inspector?: string
          inspector_employee_id?: string | null
          items?: Json
          photos?: Json
          pull_list_id?: string | null
          result?: string
          trailer_id?: string | null
          truck_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_inspections_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inspections_inspector_employee_id_fkey"
            columns: ["inspector_employee_id"]
            isOneToOne: false
            referencedRelation: "warehouse_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inspections_pull_list_id_fkey"
            columns: ["pull_list_id"]
            isOneToOne: false
            referencedRelation: "warehouse_pull_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inspections_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inspections_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_pull_list_rolls: {
        Row: {
          created_at: string
          id: string
          inv_roll_id: string | null
          lengths_needed: string | null
          position: number
          pull_list_id: string
          roll_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          inv_roll_id?: string | null
          lengths_needed?: string | null
          position?: number
          pull_list_id: string
          roll_number: string
        }
        Update: {
          created_at?: string
          id?: string
          inv_roll_id?: string | null
          lengths_needed?: string | null
          position?: number
          pull_list_id?: string
          roll_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_pull_list_rolls_inv_roll_id_fkey"
            columns: ["inv_roll_id"]
            isOneToOne: false
            referencedRelation: "inv_rolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_pull_list_rolls_pull_list_id_fkey"
            columns: ["pull_list_id"]
            isOneToOne: false
            referencedRelation: "warehouse_pull_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_pull_lists: {
        Row: {
          address: string | null
          bagged_fine_sand: number
          bagged_misc: number
          bagged_none: boolean
          bagged_standard_sand: number
          bagged_wonderfill: number
          client_id: string | null
          client_name: string | null
          created_at: string
          created_by_profile: string | null
          crew_lead: string | null
          crew_lead_employee_id: string | null
          driver: string | null
          driver_employee_id: string | null
          driver_signed_at: string | null
          driver_signed_by: string | null
          glue_gal: number
          id: string
          inv_allocation_id: string | null
          job_date: string
          job_number: string | null
          jobber_visit_id: string | null
          lead_signed_at: string | null
          lead_signed_by: string | null
          loose_warehouse: string | null
          loose_yard_delivery: string | null
          loose_yard_pickup: string | null
          nails_boxes: number
          notes: string | null
          seam_tape_rolls: number
          stager: string | null
          stager_employee_id: string | null
          stager_signed_at: string | null
          stager_signed_by: string | null
          staples_boxes: number
          status: string
          turf_batch_number: string | null
          turf_linear_runs: string | null
          turf_product: string | null
          turf_total_sqft: number | null
          updated_at: string
          weed_barrier: string | null
        }
        Insert: {
          address?: string | null
          bagged_fine_sand?: number
          bagged_misc?: number
          bagged_none?: boolean
          bagged_standard_sand?: number
          bagged_wonderfill?: number
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by_profile?: string | null
          crew_lead?: string | null
          crew_lead_employee_id?: string | null
          driver?: string | null
          driver_employee_id?: string | null
          driver_signed_at?: string | null
          driver_signed_by?: string | null
          glue_gal?: number
          id?: string
          inv_allocation_id?: string | null
          job_date: string
          job_number?: string | null
          jobber_visit_id?: string | null
          lead_signed_at?: string | null
          lead_signed_by?: string | null
          loose_warehouse?: string | null
          loose_yard_delivery?: string | null
          loose_yard_pickup?: string | null
          nails_boxes?: number
          notes?: string | null
          seam_tape_rolls?: number
          stager?: string | null
          stager_employee_id?: string | null
          stager_signed_at?: string | null
          stager_signed_by?: string | null
          staples_boxes?: number
          status?: string
          turf_batch_number?: string | null
          turf_linear_runs?: string | null
          turf_product?: string | null
          turf_total_sqft?: number | null
          updated_at?: string
          weed_barrier?: string | null
        }
        Update: {
          address?: string | null
          bagged_fine_sand?: number
          bagged_misc?: number
          bagged_none?: boolean
          bagged_standard_sand?: number
          bagged_wonderfill?: number
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by_profile?: string | null
          crew_lead?: string | null
          crew_lead_employee_id?: string | null
          driver?: string | null
          driver_employee_id?: string | null
          driver_signed_at?: string | null
          driver_signed_by?: string | null
          glue_gal?: number
          id?: string
          inv_allocation_id?: string | null
          job_date?: string
          job_number?: string | null
          jobber_visit_id?: string | null
          lead_signed_at?: string | null
          lead_signed_by?: string | null
          loose_warehouse?: string | null
          loose_yard_delivery?: string | null
          loose_yard_pickup?: string | null
          nails_boxes?: number
          notes?: string | null
          seam_tape_rolls?: number
          stager?: string | null
          stager_employee_id?: string | null
          stager_signed_at?: string | null
          stager_signed_by?: string | null
          staples_boxes?: number
          status?: string
          turf_batch_number?: string | null
          turf_linear_runs?: string | null
          turf_product?: string | null
          turf_total_sqft?: number | null
          updated_at?: string
          weed_barrier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_pull_lists_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "jobber_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_pull_lists_created_by_profile_fkey"
            columns: ["created_by_profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_pull_lists_crew_lead_employee_id_fkey"
            columns: ["crew_lead_employee_id"]
            isOneToOne: false
            referencedRelation: "warehouse_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_pull_lists_driver_employee_id_fkey"
            columns: ["driver_employee_id"]
            isOneToOne: false
            referencedRelation: "warehouse_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_pull_lists_inv_allocation_id_fkey"
            columns: ["inv_allocation_id"]
            isOneToOne: false
            referencedRelation: "inv_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_pull_lists_jobber_visit_id_fkey"
            columns: ["jobber_visit_id"]
            isOneToOne: false
            referencedRelation: "jobber_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_pull_lists_stager_employee_id_fkey"
            columns: ["stager_employee_id"]
            isOneToOne: false
            referencedRelation: "warehouse_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_tool_purchases: {
        Row: {
          asset_id: string | null
          category: string
          cost_cents: number
          created_at: string
          crew: string | null
          id: string
          item_name: string
          purchase_date: string
          quantity: number
          receipt_url: string | null
          submitted_by_employee_id: string | null
          submitted_by_profile: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          asset_id?: string | null
          category?: string
          cost_cents?: number
          created_at?: string
          crew?: string | null
          id?: string
          item_name: string
          purchase_date: string
          quantity?: number
          receipt_url?: string | null
          submitted_by_employee_id?: string | null
          submitted_by_profile?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          asset_id?: string | null
          category?: string
          cost_cents?: number
          created_at?: string
          crew?: string | null
          id?: string
          item_name?: string
          purchase_date?: string
          quantity?: number
          receipt_url?: string | null
          submitted_by_employee_id?: string | null
          submitted_by_profile?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_tool_purchases_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_tool_purchases_submitted_by_employee_id_fkey"
            columns: ["submitted_by_employee_id"]
            isOneToOne: false
            referencedRelation: "warehouse_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_tool_purchases_submitted_by_profile_fkey"
            columns: ["submitted_by_profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      user_can_see_meeting: {
        Args: { m: Database["public"]["Tables"]["meetings"]["Row"] }
        Returns: boolean
      }
      user_is_marketing: { Args: never; Returns: boolean }
    }
    Enums: {
      asset_status:
        | "available"
        | "assigned_to_job"
        | "in_use_today"
        | "maintenance_needed"
        | "out_of_service"
      campaign_status: "draft" | "active" | "paused" | "completed"
      campaign_type:
        | "referral"
        | "service_spotlight"
        | "seasonal"
        | "event"
        | "other"
      content_assignee: "warehouse" | "ivana" | "stefan" | "troy"
      content_item_status:
        | "idea"
        | "scripted"
        | "scheduled_shoot"
        | "filmed"
        | "editing"
        | "ready"
        | "published"
        | "archived"
      content_item_type:
        | "long_video"
        | "short"
        | "pov_clip"
        | "before_after"
        | "photo_set"
        | "blog_post"
        | "other"
        | "voice_memo"
      feedback_category: "bug" | "feature_request" | "question" | "other"
      feedback_status: "new" | "in_progress" | "resolved" | "wont_fix"
      invoice_status:
        | "draft"
        | "submitted"
        | "ocr_processing"
        | "ocr_review_needed"
        | "awaiting_review"
        | "awaiting_approval"
        | "approved"
        | "request_change"
        | "rejected"
        | "on_hold"
        | "paid"
        | "archived"
      job_progress_state:
        | "scheduled"
        | "started"
        | "tear_out_done"
        | "base_started"
        | "base_done"
        | "turf_started"
        | "two_hours_out"
        | "turf_done"
        | "final_qa_done"
        | "on_hold"
      load_status: "empty" | "partially_loaded" | "fully_loaded" | "trash"
      maintenance_interval_type: "time" | "mileage" | "hours"
      meeting_cadence:
        | "daily"
        | "weekly"
        | "biweekly"
        | "monthly"
        | "adhoc"
        | "once"
      meeting_item_status:
        | "pending"
        | "carried_over"
        | "discussed"
        | "done"
        | "archived"
      outreach_call_status:
        | "queued"
        | "no_answer"
        | "declined"
        | "referred"
        | "do_not_call"
        | "invalid_number"
      outreach_segment: "residential" | "b2b_partner"
      po_payment_status: "not_due" | "due_soon" | "past_due" | "paid"
      po_payment_terms:
        | "paid_in_full"
        | "deposit"
        | "net_15"
        | "net_30"
        | "net_45"
        | "due_on_delivery"
        | "other"
      po_priority: "low" | "normal" | "high" | "urgent"
      po_purchase_type: "inventory_replenishment" | "project_specific"
      po_status:
        | "new_request"
        | "awaiting_review"
        | "awaiting_approval"
        | "quote_gathering"
        | "ready_to_order"
        | "order_placed"
        | "waiting_on_vendor"
        | "in_transit"
        | "delivered"
        | "payment_outstanding"
        | "closed"
        | "cancelled"
      project_status:
        | "intake"
        | "planning"
        | "waiting_customer"
        | "waiting_internal"
        | "scheduled"
        | "in_progress"
        | "blocked"
        | "ready_for_review"
        | "complete"
        | "on_hold"
        | "cancelled"
      project_type:
        | "customer_install"
        | "commercial_bid"
        | "sales_marketing"
        | "operations"
        | "warehouse"
        | "admin"
        | "strategic"
        | "warranty"
        | "technology"
      ready_status: "ready" | "needs_prep" | "not_ready"
      recurrence_freq: "daily" | "weekly" | "biweekly" | "monthly"
      referral_reward_status: "not_earned" | "due" | "sent"
      referral_reward_type: "visa_250" | "care_plan_1yr" | "undecided"
      referral_source: "call" | "jobber_link" | "word_of_mouth" | "other"
      referral_stage:
        | "lead"
        | "contacted"
        | "quoted"
        | "signed"
        | "completed_paid"
        | "lost"
      reservation_status: "active" | "cancelled" | "completed"
      review_platform: "google" | "facebook" | "jobber" | "other"
      review_status: "pending" | "requested" | "received" | "declined"
      roll_status:
        | "available"
        | "planned"
        | "allocated"
        | "staged"
        | "dispatched"
        | "consumed"
        | "damaged"
        | "returned"
      roll_type: "parent" | "child"
      task_priority: "low" | "normal" | "high" | "urgent"
      task_status:
        | "inbox"
        | "in_progress"
        | "waiting"
        | "blocked"
        | "done"
        | "archived"
      task_visibility: "private" | "team" | "public"
      unit_type: "truck" | "trailer" | "heavy_equipment" | "tool"
      user_department:
        | "sales"
        | "warehouse"
        | "office"
        | "field"
        | "marketing"
        | "financial"
      user_role: "admin" | "office" | "field"
      vendor_type:
        | "installer"
        | "contractor_1099"
        | "subcontractor"
        | "supplier"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asset_status: [
        "available",
        "assigned_to_job",
        "in_use_today",
        "maintenance_needed",
        "out_of_service",
      ],
      campaign_status: ["draft", "active", "paused", "completed"],
      campaign_type: [
        "referral",
        "service_spotlight",
        "seasonal",
        "event",
        "other",
      ],
      content_assignee: ["warehouse", "ivana", "stefan", "troy"],
      content_item_status: [
        "idea",
        "scripted",
        "scheduled_shoot",
        "filmed",
        "editing",
        "ready",
        "published",
        "archived",
      ],
      content_item_type: [
        "long_video",
        "short",
        "pov_clip",
        "before_after",
        "photo_set",
        "blog_post",
        "other",
        "voice_memo",
      ],
      feedback_category: ["bug", "feature_request", "question", "other"],
      feedback_status: ["new", "in_progress", "resolved", "wont_fix"],
      invoice_status: [
        "draft",
        "submitted",
        "ocr_processing",
        "ocr_review_needed",
        "awaiting_review",
        "awaiting_approval",
        "approved",
        "request_change",
        "rejected",
        "on_hold",
        "paid",
        "archived",
      ],
      job_progress_state: [
        "scheduled",
        "started",
        "tear_out_done",
        "base_started",
        "base_done",
        "turf_started",
        "two_hours_out",
        "turf_done",
        "final_qa_done",
        "on_hold",
      ],
      load_status: ["empty", "partially_loaded", "fully_loaded", "trash"],
      maintenance_interval_type: ["time", "mileage", "hours"],
      meeting_cadence: [
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "adhoc",
        "once",
      ],
      meeting_item_status: [
        "pending",
        "carried_over",
        "discussed",
        "done",
        "archived",
      ],
      outreach_call_status: [
        "queued",
        "no_answer",
        "declined",
        "referred",
        "do_not_call",
        "invalid_number",
      ],
      outreach_segment: ["residential", "b2b_partner"],
      po_payment_status: ["not_due", "due_soon", "past_due", "paid"],
      po_payment_terms: [
        "paid_in_full",
        "deposit",
        "net_15",
        "net_30",
        "net_45",
        "due_on_delivery",
        "other",
      ],
      po_priority: ["low", "normal", "high", "urgent"],
      po_purchase_type: ["inventory_replenishment", "project_specific"],
      po_status: [
        "new_request",
        "awaiting_review",
        "awaiting_approval",
        "quote_gathering",
        "ready_to_order",
        "order_placed",
        "waiting_on_vendor",
        "in_transit",
        "delivered",
        "payment_outstanding",
        "closed",
        "cancelled",
      ],
      project_status: [
        "intake",
        "planning",
        "waiting_customer",
        "waiting_internal",
        "scheduled",
        "in_progress",
        "blocked",
        "ready_for_review",
        "complete",
        "on_hold",
        "cancelled",
      ],
      project_type: [
        "customer_install",
        "commercial_bid",
        "sales_marketing",
        "operations",
        "warehouse",
        "admin",
        "strategic",
        "warranty",
        "technology",
      ],
      ready_status: ["ready", "needs_prep", "not_ready"],
      recurrence_freq: ["daily", "weekly", "biweekly", "monthly"],
      referral_reward_status: ["not_earned", "due", "sent"],
      referral_reward_type: ["visa_250", "care_plan_1yr", "undecided"],
      referral_source: ["call", "jobber_link", "word_of_mouth", "other"],
      referral_stage: [
        "lead",
        "contacted",
        "quoted",
        "signed",
        "completed_paid",
        "lost",
      ],
      reservation_status: ["active", "cancelled", "completed"],
      review_platform: ["google", "facebook", "jobber", "other"],
      review_status: ["pending", "requested", "received", "declined"],
      roll_status: [
        "available",
        "planned",
        "allocated",
        "staged",
        "dispatched",
        "consumed",
        "damaged",
        "returned",
      ],
      roll_type: ["parent", "child"],
      task_priority: ["low", "normal", "high", "urgent"],
      task_status: [
        "inbox",
        "in_progress",
        "waiting",
        "blocked",
        "done",
        "archived",
      ],
      task_visibility: ["private", "team", "public"],
      unit_type: ["truck", "trailer", "heavy_equipment", "tool"],
      user_department: [
        "sales",
        "warehouse",
        "office",
        "field",
        "marketing",
        "financial",
      ],
      user_role: ["admin", "office", "field"],
      vendor_type: [
        "installer",
        "contractor_1099",
        "subcontractor",
        "supplier",
        "other",
      ],
    },
  },
} as const
