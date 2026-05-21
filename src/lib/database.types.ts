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
