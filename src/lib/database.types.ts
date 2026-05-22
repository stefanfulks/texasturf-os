// Auto-generated Supabase types for TexasTurf OS
// Schema: public · Project: ybedvthhofoutbqgwnvm
// Regenerate when schema changes: npx supabase gen types typescript --project-id ybedvthhofoutbqgwnvm > src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: Database["public"]["Enums"]["user_role"]
          department_id: string | null
          title: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          department_id?: string | null
          title?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          department_id?: string | null
          title?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          id: string
          name: string
          unit_type: Database["public"]["Enums"]["unit_type"]
          status: Database["public"]["Enums"]["asset_status"]
          ready_status: Database["public"]["Enums"]["ready_status"]
          load_status: Database["public"]["Enums"]["load_status"]
          primary_unit: boolean
          attached_to_id: string | null
          owner_id: string | null
          next_action: string | null
          notes: string | null
          monday_item_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          unit_type: Database["public"]["Enums"]["unit_type"]
          status?: Database["public"]["Enums"]["asset_status"]
          ready_status?: Database["public"]["Enums"]["ready_status"]
          load_status?: Database["public"]["Enums"]["load_status"]
          primary_unit?: boolean
          attached_to_id?: string | null
          owner_id?: string | null
          next_action?: string | null
          notes?: string | null
          monday_item_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          unit_type?: Database["public"]["Enums"]["unit_type"]
          status?: Database["public"]["Enums"]["asset_status"]
          ready_status?: Database["public"]["Enums"]["ready_status"]
          load_status?: Database["public"]["Enums"]["load_status"]
          primary_unit?: boolean
          attached_to_id?: string | null
          owner_id?: string | null
          next_action?: string | null
          notes?: string | null
          monday_item_id?: string | null
          created_at?: string
          updated_at?: string
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
      projects: {
        Row: {
          id: string
          name: string
          type: Database["public"]["Enums"]["project_type"]
          status: Database["public"]["Enums"]["project_status"]
          priority: Database["public"]["Enums"]["task_priority"]
          owner_id: string
          department_id: string | null
          customer_name: string | null
          address: string | null
          description: string | null
          start_date: string | null
          due_date: string | null
          target_install_date: string | null
          jobber_url: string | null
          monday_item_id: string | null
          slack_channel_id: string | null
          archived: boolean
          created_by_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: Database["public"]["Enums"]["project_type"]
          status?: Database["public"]["Enums"]["project_status"]
          priority?: Database["public"]["Enums"]["task_priority"]
          owner_id: string
          department_id?: string | null
          customer_name?: string | null
          address?: string | null
          description?: string | null
          start_date?: string | null
          due_date?: string | null
          target_install_date?: string | null
          jobber_url?: string | null
          monday_item_id?: string | null
          slack_channel_id?: string | null
          archived?: boolean
          created_by_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["project_type"]
          status?: Database["public"]["Enums"]["project_status"]
          priority?: Database["public"]["Enums"]["task_priority"]
          owner_id?: string
          department_id?: string | null
          customer_name?: string | null
          address?: string | null
          description?: string | null
          start_date?: string | null
          due_date?: string | null
          target_install_date?: string | null
          jobber_url?: string | null
          monday_item_id?: string | null
          slack_channel_id?: string | null
          archived?: boolean
          created_by_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: string
          added_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role?: string
          added_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: string
          added_at?: string
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
      maintenance_schedules: {
        Row: {
          id: string
          asset_id: string
          name: string
          interval_type: Database["public"]["Enums"]["maintenance_interval_type"]
          interval_value: number
          last_serviced_at: string | null
          last_serviced_meter: number | null
          next_due_at: string | null
          next_due_meter: number | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          name: string
          interval_type: Database["public"]["Enums"]["maintenance_interval_type"]
          interval_value: number
          last_serviced_at?: string | null
          last_serviced_meter?: number | null
          next_due_at?: string | null
          next_due_meter?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          name?: string
          interval_type?: Database["public"]["Enums"]["maintenance_interval_type"]
          interval_value?: number
          last_serviced_at?: string | null
          last_serviced_meter?: number | null
          next_due_at?: string | null
          next_due_meter?: number | null
          active?: boolean
          created_at?: string
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
      departments: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: Database["public"]["Enums"]["task_status"]
          priority: Database["public"]["Enums"]["task_priority"]
          assignee_id: string
          created_by_id: string
          project_id: string | null
          department_id: string | null
          due_date: string | null
          start_date: string | null
          completed_at: string | null
          blocked_reason: string | null
          visibility: Database["public"]["Enums"]["task_visibility"]
          tags: string[]
          monday_item_id: string | null
          recurring_rule_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          priority?: Database["public"]["Enums"]["task_priority"]
          assignee_id: string
          created_by_id: string
          project_id?: string | null
          department_id?: string | null
          due_date?: string | null
          start_date?: string | null
          completed_at?: string | null
          blocked_reason?: string | null
          visibility?: Database["public"]["Enums"]["task_visibility"]
          tags?: string[]
          monday_item_id?: string | null
          recurring_rule_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          priority?: Database["public"]["Enums"]["task_priority"]
          assignee_id?: string
          created_by_id?: string
          project_id?: string | null
          department_id?: string | null
          due_date?: string | null
          start_date?: string | null
          completed_at?: string | null
          blocked_reason?: string | null
          visibility?: Database["public"]["Enums"]["task_visibility"]
          tags?: string[]
          monday_item_id?: string | null
          recurring_rule_id?: string | null
          created_at?: string
          updated_at?: string
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
        ]
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          body: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          body: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          body?: string
          created_at?: string
          updated_at?: string
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
      task_activity: {
        Row: {
          id: string
          task_id: string
          actor_id: string
          event_type: string
          old_value: string | null
          new_value: string | null
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          actor_id: string
          event_type: string
          old_value?: string | null
          new_value?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          actor_id?: string
          event_type?: string
          old_value?: string | null
          new_value?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          id: string
          title: string
          description: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          assignee_id: string
          created_by_id: string
          project_id: string | null
          department_id: string | null
          visibility: Database["public"]["Enums"]["task_visibility"]
          freq: Database["public"]["Enums"]["recurrence_freq"]
          day_of_week: number | null
          day_of_month: number | null
          lead_days: number
          active: boolean
          last_generated: string | null
          next_due: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          assignee_id: string
          created_by_id: string
          project_id?: string | null
          department_id?: string | null
          visibility?: Database["public"]["Enums"]["task_visibility"]
          freq?: Database["public"]["Enums"]["recurrence_freq"]
          day_of_week?: number | null
          day_of_month?: number | null
          lead_days?: number
          active?: boolean
          last_generated?: string | null
          next_due?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          assignee_id?: string
          created_by_id?: string
          project_id?: string | null
          department_id?: string | null
          visibility?: Database["public"]["Enums"]["task_visibility"]
          freq?: Database["public"]["Enums"]["recurrence_freq"]
          day_of_week?: number | null
          day_of_month?: number | null
          lead_days?: number
          active?: boolean
          last_generated?: string | null
          next_due?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          actor_id: string | null
          type: string
          title: string
          body: string | null
          resource_type: string | null
          resource_id: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          actor_id?: string | null
          type: string
          title: string
          body?: string | null
          resource_type?: string | null
          resource_id?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          actor_id?: string | null
          type?: string
          title?: string
          body?: string | null
          resource_type?: string | null
          resource_id?: string | null
          read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          id: string
          asset_id: string
          schedule_id: string | null
          performed_at: string
          description: string
          cost_cents: number
          meter_value: number | null
          performed_by_profile: string | null
          performed_by_vendor: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          schedule_id?: string | null
          performed_at?: string
          description: string
          cost_cents?: number
          meter_value?: number | null
          performed_by_profile?: string | null
          performed_by_vendor?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          schedule_id?: string | null
          performed_at?: string
          description?: string
          cost_cents?: number
          meter_value?: number | null
          performed_by_profile?: string | null
          performed_by_vendor?: string | null
          notes?: string | null
          created_at?: string
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
            foreignKeyName: "maintenance_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_performed_by_profile_fkey"
            columns: ["performed_by_profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          id: string
          name: string
          type: Database["public"]["Enums"]["vendor_type"]
          contact_name: string | null
          email: string | null
          phone: string | null
          address: string | null
          payment_terms: string | null
          default_rates: Record<string, unknown> | null
          notes: string | null
          active: boolean
          monday_item_id: string | null
          created_by_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: Database["public"]["Enums"]["vendor_type"]
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          payment_terms?: string | null
          default_rates?: Record<string, unknown> | null
          notes?: string | null
          active?: boolean
          monday_item_id?: string | null
          created_by_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["vendor_type"]
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          payment_terms?: string | null
          default_rates?: Record<string, unknown> | null
          notes?: string | null
          active?: boolean
          monday_item_id?: string | null
          created_by_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          title: string
          vendor_id: string | null
          submitted_by_id: string
          reviewed_by_id: string | null
          approved_by_id: string | null
          paid_by_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          invoice_number: string | null
          invoice_date: string | null
          service_period_start: string | null
          service_period_end: string | null
          approval_deadline: string | null
          subtotal: number | null
          tax: number | null
          total_amount: number | null
          currency: string
          project_id: string | null
          job_name: string | null
          customer_name: string | null
          jobber_url: string | null
          original_file_url: string | null
          original_file_type: string | null
          original_file_name: string | null
          ocr_text: string | null
          ocr_confidence: number | null
          ocr_reviewed: boolean
          admin_notes: string | null
          variance_notes: string | null
          ownership_notes: string | null
          payment_notes: string | null
          change_request_reason: string | null
          duplicate_warning: boolean
          archived: boolean
          monday_item_id: string | null
          monday_board_id: string | null
          slack_thread_ts: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          submitted_at: string
          reviewed_at: string | null
          approved_at: string | null
          status_changed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          vendor_id?: string | null
          submitted_by_id: string
          reviewed_by_id?: string | null
          approved_by_id?: string | null
          paid_by_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          invoice_number?: string | null
          invoice_date?: string | null
          service_period_start?: string | null
          service_period_end?: string | null
          approval_deadline?: string | null
          subtotal?: number | null
          tax?: number | null
          total_amount?: number | null
          currency?: string
          project_id?: string | null
          job_name?: string | null
          customer_name?: string | null
          jobber_url?: string | null
          original_file_url?: string | null
          original_file_type?: string | null
          original_file_name?: string | null
          ocr_text?: string | null
          ocr_confidence?: number | null
          ocr_reviewed?: boolean
          admin_notes?: string | null
          variance_notes?: string | null
          ownership_notes?: string | null
          payment_notes?: string | null
          change_request_reason?: string | null
          duplicate_warning?: boolean
          archived?: boolean
          monday_item_id?: string | null
          monday_board_id?: string | null
          slack_thread_ts?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          submitted_at?: string
          reviewed_at?: string | null
          approved_at?: string | null
          status_changed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          vendor_id?: string | null
          submitted_by_id?: string
          reviewed_by_id?: string | null
          approved_by_id?: string | null
          paid_by_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          invoice_number?: string | null
          invoice_date?: string | null
          service_period_start?: string | null
          service_period_end?: string | null
          approval_deadline?: string | null
          subtotal?: number | null
          tax?: number | null
          total_amount?: number | null
          currency?: string
          project_id?: string | null
          job_name?: string | null
          customer_name?: string | null
          jobber_url?: string | null
          original_file_url?: string | null
          original_file_type?: string | null
          original_file_name?: string | null
          ocr_text?: string | null
          ocr_confidence?: number | null
          ocr_reviewed?: boolean
          admin_notes?: string | null
          variance_notes?: string | null
          ownership_notes?: string | null
          payment_notes?: string | null
          change_request_reason?: string | null
          duplicate_warning?: boolean
          archived?: boolean
          monday_item_id?: string | null
          monday_board_id?: string | null
          slack_thread_ts?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          submitted_at?: string
          reviewed_at?: string | null
          approved_at?: string | null
          status_changed_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          normalized_description: string | null
          category: string | null
          quantity: number | null
          unit: string | null
          unit_price: number | null
          line_total: number
          expected_unit_price: number | null
          variance_amount: number | null
          variance_percent: number | null
          variance_status: string
          variance_reason: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          normalized_description?: string | null
          category?: string | null
          quantity?: number | null
          unit?: string | null
          unit_price?: number | null
          line_total?: number
          expected_unit_price?: number | null
          variance_amount?: number | null
          variance_percent?: number | null
          variance_status?: string
          variance_reason?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          description?: string
          normalized_description?: string | null
          category?: string | null
          quantity?: number | null
          unit?: string | null
          unit_price?: number | null
          line_total?: number
          expected_unit_price?: number | null
          variance_amount?: number | null
          variance_percent?: number | null
          variance_status?: string
          variance_reason?: string | null
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      invoice_status_history: {
        Row: {
          id: string
          invoice_id: string
          previous_status: Database["public"]["Enums"]["invoice_status"] | null
          new_status: Database["public"]["Enums"]["invoice_status"]
          changed_by_id: string | null
          notes: string | null
          notification_sent: boolean
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          previous_status?: Database["public"]["Enums"]["invoice_status"] | null
          new_status: Database["public"]["Enums"]["invoice_status"]
          changed_by_id?: string | null
          notes?: string | null
          notification_sent?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          previous_status?: Database["public"]["Enums"]["invoice_status"] | null
          new_status?: Database["public"]["Enums"]["invoice_status"]
          changed_by_id?: string | null
          notes?: string | null
          notification_sent?: boolean
          created_at?: string
        }
        Relationships: []
      }
      invoice_comments: {
        Row: {
          id: string
          invoice_id: string
          user_id: string
          body: string
          visibility: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          user_id: string
          body: string
          visibility?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          user_id?: string
          body?: string
          visibility?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_versions: {
        Row: {
          id: string
          invoice_id: string
          version_number: number
          file_url: string
          file_name: string | null
          submitted_by_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          version_number?: number
          file_url: string
          file_name?: string | null
          submitted_by_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          version_number?: number
          file_url?: string
          file_name?: string | null
          submitted_by_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ocr_jobs: {
        Row: {
          id: string
          invoice_id: string
          provider: string
          status: string
          raw_response: Record<string, unknown> | null
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          provider?: string
          status?: string
          raw_response?: Record<string, unknown> | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          provider?: string
          status?: string
          raw_response?: Record<string, unknown> | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      integration_sync_logs: {
        Row: {
          id: string
          provider: string
          local_entity_type: string
          local_entity_id: string
          external_entity_id: string | null
          direction: string
          status: string
          message: string | null
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          provider: string
          local_entity_type: string
          local_entity_id: string
          external_entity_id?: string | null
          direction?: string
          status: string
          message?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          provider?: string
          local_entity_type?: string
          local_entity_id?: string
          external_entity_id?: string | null
          direction?: string
          status?: string
          message?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      current_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      user_role: "admin" | "office" | "field"
      unit_type: "truck" | "trailer" | "heavy_equipment"
      asset_status:
        | "available"
        | "assigned_to_job"
        | "in_use_today"
        | "maintenance_needed"
        | "out_of_service"
      ready_status: "ready" | "needs_prep" | "not_ready"
      load_status: "empty" | "partially_loaded" | "fully_loaded" | "trash"
      maintenance_interval_type: "time" | "mileage" | "hours"
      task_status: "inbox" | "in_progress" | "waiting" | "blocked" | "done" | "archived"
      task_priority: "low" | "normal" | "high" | "urgent"
      task_visibility: "private" | "team" | "public"
      project_status: "intake" | "planning" | "waiting_customer" | "waiting_internal" | "scheduled" | "in_progress" | "blocked" | "ready_for_review" | "complete" | "on_hold" | "cancelled"
      project_type: "customer_install" | "commercial_bid" | "sales_marketing" | "operations" | "warehouse" | "admin" | "strategic" | "warranty" | "technology"
      recurrence_freq: "daily" | "weekly" | "biweekly" | "monthly"
      invoice_status: "draft" | "submitted" | "ocr_processing" | "ocr_review_needed" | "awaiting_review" | "awaiting_approval" | "approved" | "request_change" | "rejected" | "on_hold" | "paid" | "archived"
      vendor_type: "installer" | "contractor_1099" | "subcontractor" | "supplier" | "other"
    }
    CompositeTypes: Record<string, never>
  }
}

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
