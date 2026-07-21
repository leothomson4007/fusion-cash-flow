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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      cash_submissions: {
        Row: {
          collector_id: string
          created_at: string
          declared_amount: number
          difference: number | null
          expected_amount: number
          id: string
          notes: string | null
          received_amount: number | null
          status: Database["public"]["Enums"]["submission_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          collector_id: string
          created_at?: string
          declared_amount: number
          difference?: number | null
          expected_amount?: number
          id?: string
          notes?: string | null
          received_amount?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          collector_id?: string
          created_at?: string
          declared_amount?: number
          difference?: number | null
          expected_amount?: number
          id?: string
          notes?: string | null
          received_amount?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          area: string | null
          billing_day: number
          created_at: string
          created_by: string | null
          customer_no: string
          deleted_at: string | null
          full_name: string
          id: string
          monthly_bill: number
          notes: string | null
          opening_balance: number
          package_name: string | null
          phone: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          area?: string | null
          billing_day?: number
          created_at?: string
          created_by?: string | null
          customer_no: string
          deleted_at?: string | null
          full_name: string
          id?: string
          monthly_bill?: number
          notes?: string | null
          opening_balance?: number
          package_name?: string | null
          phone?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          area?: string | null
          billing_day?: number
          created_at?: string
          created_by?: string | null
          customer_no?: string
          deleted_at?: string | null
          full_name?: string
          id?: string
          monthly_bill?: number
          notes?: string | null
          opening_balance?: number
          package_name?: string | null
          phone?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      receipt_sequence: {
        Row: {
          last_no: number
          year: number
        }
        Insert: {
          last_no?: number
          year: number
        }
        Update: {
          last_no?: number
          year?: number
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number
          cancelled_reason: string | null
          collector_id: string | null
          created_at: string
          created_by: string
          customer_id: string
          id: string
          note: string | null
          payment_reference: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          previous_due: number | null
          receipt_no: string
          remaining_due: number | null
          seq: number
          status: Database["public"]["Enums"]["receipt_status"]
          updated_at: string
          year: number
        }
        Insert: {
          amount: number
          cancelled_reason?: string | null
          collector_id?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          note?: string | null
          payment_reference?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          previous_due?: number | null
          receipt_no: string
          remaining_due?: number | null
          seq: number
          status?: Database["public"]["Enums"]["receipt_status"]
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          cancelled_reason?: string | null
          collector_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          note?: string | null
          payment_reference?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          previous_due?: number | null
          receipt_no?: string
          remaining_due?: number | null
          seq?: number
          status?: Database["public"]["Enums"]["receipt_status"]
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      customer_balances: {
        Row: {
          address: string | null
          area: string | null
          balance: number | null
          billing_day: number | null
          bills_accrued: number | null
          customer_id: string | null
          customer_no: string | null
          full_name: string | null
          monthly_bill: number | null
          opening_balance: number | null
          package_name: string | null
          phone: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["customer_status"] | null
          total_paid: number | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          balance?: never
          billing_day?: number | null
          bills_accrued?: never
          customer_id?: string | null
          customer_no?: string | null
          full_name?: string | null
          monthly_bill?: number | null
          opening_balance?: number | null
          package_name?: string | null
          phone?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["customer_status"] | null
          total_paid?: never
        }
        Update: {
          address?: string | null
          area?: string | null
          balance?: never
          billing_day?: number | null
          bills_accrued?: never
          customer_id?: string | null
          customer_no?: string | null
          full_name?: string | null
          monthly_bill?: number | null
          opening_balance?: number | null
          package_name?: string | null
          phone?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["customer_status"] | null
          total_paid?: never
        }
        Relationships: []
      }
    }
    Functions: {
      admin_cancel_receipt: {
        Args: { _id: string; _reason: string }
        Returns: {
          amount: number
          cancelled_reason: string | null
          collector_id: string | null
          created_at: string
          created_by: string
          customer_id: string
          id: string
          note: string | null
          payment_reference: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          previous_due: number | null
          receipt_no: string
          remaining_due: number | null
          seq: number
          status: Database["public"]["Enums"]["receipt_status"]
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_delete_customer: {
        Args: { _id: string; _reason: string }
        Returns: {
          address: string | null
          area: string | null
          billing_day: number
          created_at: string
          created_by: string | null
          customer_no: string
          deleted_at: string | null
          full_name: string
          id: string
          monthly_bill: number
          notes: string | null
          opening_balance: number
          package_name: string | null
          phone: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_exists: { Args: never; Returns: boolean }
      admin_restore_customer: {
        Args: { _id: string }
        Returns: {
          address: string | null
          area: string | null
          billing_day: number
          created_at: string
          created_by: string | null
          customer_no: string
          deleted_at: string | null
          full_name: string
          id: string
          monthly_bill: number
          notes: string | null
          opening_balance: number
          package_name: string | null
          phone: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_update_receipt: {
        Args: {
          _amount: number
          _id: string
          _note: string
          _payment_reference?: string
          _payment_type: Database["public"]["Enums"]["payment_type"]
          _reason: string
        }
        Returns: {
          amount: number
          cancelled_reason: string | null
          collector_id: string | null
          created_at: string
          created_by: string
          customer_id: string
          id: string
          note: string | null
          payment_reference: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          previous_due: number | null
          receipt_no: string
          remaining_due: number | null
          seq: number
          status: Database["public"]["Enums"]["receipt_status"]
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_upsert_customer: {
        Args: {
          _address: string
          _area: string
          _billing_day: number
          _full_name: string
          _id: string
          _internet_speed?: string
          _monthly_bill: number
          _notes: string
          _opening_balance: number
          _package_name?: string
          _phone: string
          _service_type?: string
          _status: Database["public"]["Enums"]["customer_status"]
        }
        Returns: {
          address: string | null
          area: string | null
          billing_day: number
          created_at: string
          created_by: string | null
          customer_no: string
          deleted_at: string | null
          full_name: string
          id: string
          monthly_bill: number
          notes: string | null
          opening_balance: number
          package_name: string | null
          phone: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_first_admin: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      collector_expected_cash: { Args: { _uid: string }; Returns: number }
      create_receipt: {
        Args: {
          _amount: number
          _customer_id: string
          _note?: string
          _payment_reference?: string
          _payment_type?: Database["public"]["Enums"]["payment_type"]
        }
        Returns: {
          amount: number
          cancelled_reason: string | null
          collector_id: string | null
          created_at: string
          created_by: string
          customer_id: string
          id: string
          note: string | null
          payment_reference: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          previous_due: number | null
          receipt_no: string
          remaining_due: number | null
          seq: number
          status: Database["public"]["Enums"]["receipt_status"]
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      customer_bills_accrued: {
        Args: { _c: Database["public"]["Tables"]["customers"]["Row"] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_staff: {
        Args: never
        Returns: {
          active: boolean
          full_name: string
          id: string
          phone: string
          roles: Database["public"]["Enums"]["app_role"][]
        }[]
      }
      next_customer_no: { Args: never; Returns: string }
      submit_cash: {
        Args: { _declared: number; _notes: string }
        Returns: {
          collector_id: string
          created_at: string
          declared_amount: number
          difference: number | null
          expected_amount: number
          id: string
          notes: string | null
          received_amount: number | null
          status: Database["public"]["Enums"]["submission_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cash_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_cash: {
        Args: { _id: string; _notes: string; _received: number }
        Returns: {
          collector_id: string
          created_at: string
          declared_amount: number
          difference: number | null
          expected_amount: number
          id: string
          notes: string | null
          received_amount: number | null
          status: Database["public"]["Enums"]["submission_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cash_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      write_audit: {
        Args: {
          _action: string
          _entity: string
          _entity_id: string
          _new: Json
          _old: Json
          _reason: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "collector"
      customer_status: "active" | "inactive" | "deleted"
      payment_type: "cash" | "bank" | "easypaisa" | "jazzcash"
      receipt_status: "active" | "cancelled"
      submission_status: "pending" | "verified"
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
      app_role: ["admin", "collector"],
      customer_status: ["active", "inactive", "deleted"],
      payment_type: ["cash", "bank", "easypaisa", "jazzcash"],
      receipt_status: ["active", "cancelled"],
      submission_status: ["pending", "verified"],
    },
  },
} as const
