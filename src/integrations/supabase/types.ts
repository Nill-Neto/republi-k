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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          group_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          group_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          group_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletin_posts: {
        Row: {
          content: string
          created_at: string
          created_by: string
          group_id: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          brand: string
          closing_day: number
          created_at: string
          due_day: number
          id: string
          label: string
          limit_amount: number | null
          user_id: string
        }
        Insert: {
          brand: string
          closing_day: number
          created_at?: string
          due_day: number
          id?: string
          label: string
          limit_amount?: number | null
          user_id: string
        }
        Update: {
          brand?: string
          closing_day?: number
          created_at?: string
          due_day?: number
          id?: string
          label?: string
          limit_amount?: number | null
          user_id?: string
        }
        Relationships: []
      }
      expense_installments: {
        Row: {
          amount: number
          bill_month: number
          bill_year: number
          created_at: string
          expense_id: string
          id: string
          installment_number: number
          user_id: string
        }
        Insert: {
          amount: number
          bill_month: number
          bill_year: number
          created_at?: string
          expense_id: string
          id?: string
          installment_number: number
          user_id: string
        }
        Update: {
          amount?: number
          bill_month?: number
          bill_year?: number
          created_at?: string
          expense_id?: string
          id?: string
          installment_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_installments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_splits: {
        Row: {
          amount: number
          created_at: string
          expense_id: string
          id: string
          paid_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expense_id: string
          id?: string
          paid_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expense_id?: string
          id?: string
          paid_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          credit_card_id: string | null
          description: string | null
          due_date: string | null
          expense_type: string
          group_id: string
          id: string
          installments: number
          instantallments: number | null
          paid_to_provider: boolean
          payment_method: string
          purchase_date: string
          receipt_url: string | null
          recurring_expense_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by: string
          credit_card_id?: string | null
          description?: string | null
          due_date?: string | null
          expense_type?: string
          group_id: string
          id?: string
          installments?: number
          instantallments?: number | null
          paid_to_provider?: boolean
          payment_method?: string
          purchase_date?: string
          receipt_url?: string | null
          recurring_expense_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          credit_card_id?: string | null
          description?: string | null
          due_date?: string | null
          expense_type?: string
          group_id?: string
          id?: string
          installments?: number
          instantallments?: number | null
          paid_to_provider?: boolean
          payment_method?: string
          purchase_date?: string
          receipt_url?: string | null
          recurring_expense_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          active: boolean
          group_id: string
          id: string
          joined_at: string
          left_at: string | null
          split_percentage: number | null
          user_id: string
        }
        Insert: {
          active?: boolean
          group_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          split_percentage?: number | null
          user_id: string
        }
        Update: {
          active?: boolean
          group_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          split_percentage?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          closing_day: number | null
          created_at: string
          created_by: string | null
          description: string | null
          due_day: number | null
          id: string
          name: string
          splitting_rule: Database["public"]["Enums"]["splitting_rule"]
          updated_at: string
        }
        Insert: {
          closing_day?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_day?: number | null
          id?: string
          name: string
          splitting_rule?: Database["public"]["Enums"]["splitting_rule"]
          updated_at?: string
        }
        Update: {
          closing_day?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_day?: number | null
          id?: string
          name?: string
          splitting_rule?: Database["public"]["Enums"]["splitting_rule"]
          updated_at?: string
        }
        Relationships: []
      }
      house_rules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          group_id: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          group_id: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          group_id?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_rules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          created_by: string
          group_id: string
          id: string
          min_quantity: number
          name: string
          quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          min_quantity?: number
          name: string
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          min_quantity?: number
          name?: string
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          group_id: string
          id: string
          invited_by: string
          status: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          group_id: string
          id?: string
          invited_by: string
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          group_id?: string
          id?: string
          invited_by?: string
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          group_id: string | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          group_id?: string | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          group_id?: string | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          expense_split_id: string | null
          group_id: string
          id: string
          notes: string | null
          paid_by: string
          receipt_url: string | null
          status: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          expense_split_id?: string | null
          group_id: string
          id?: string
          notes?: string | null
          paid_by: string
          receipt_url?: string | null
          status?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          expense_split_id?: string | null
          group_id?: string
          id?: string
          notes?: string | null
          paid_by?: string
          receipt_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_expense_split_id_fkey"
            columns: ["expense_split_id"]
            isOneToOne: false
            referencedRelation: "expense_splits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_expense_installments: {
        Row: {
          amount: number
          bill_month: number
          bill_year: number
          created_at: string
          id: string
          installment_number: number
          personal_expense_id: string
          user_id: string
        }
        Insert: {
          amount: number
          bill_month: number
          bill_year: number
          created_at?: string
          id?: string
          installment_number: number
          personal_expense_id: string
          user_id: string
        }
        Update: {
          amount?: number
          bill_month?: number
          bill_year?: number
          created_at?: string
          id?: string
          installment_number?: number
          personal_expense_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_expense_installments_personal_expense_id_fkey"
            columns: ["personal_expense_id"]
            isOneToOne: false
            referencedRelation: "personal_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_expenses: {
        Row: {
          amount: number
          created_at: string
          credit_card_id: string | null
          id: string
          installments: number
          payment_method: string
          purchase_date: string
          title: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credit_card_id?: string | null
          id?: string
          installments?: number
          payment_method: string
          purchase_date: string
          title: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_card_id?: string | null
          id?: string
          installments?: number
          payment_method?: string
          purchase_date?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_expenses_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          created_at: string
          id: string
          label: string
          poll_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          poll_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          poll_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          anonymous: boolean
          closes_at: string | null
          created_at: string
          created_by: string
          description: string | null
          group_id: string
          id: string
          multiple_choice: boolean
          question: string
          status: string
          updated_at: string
        }
        Insert: {
          anonymous?: boolean
          closes_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          group_id: string
          id?: string
          multiple_choice?: boolean
          question: string
          status?: string
          updated_at?: string
        }
        Update: {
          anonymous?: boolean
          closes_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          group_id?: string
          id?: string
          multiple_choice?: boolean
          question?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_sensitive: {
        Row: {
          cpf: string
          created_at: string
          user_id: string
        }
        Insert: {
          cpf: string
          created_at?: string
          user_id: string
        }
        Update: {
          cpf?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          onboarding_completed: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          onboarding_completed?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          active: boolean
          amount: number
          category: string
          created_at: string
          created_by: string
          day_of_month: number | null
          description: string | null
          frequency: string
          group_id: string
          id: string
          last_generated_at: string | null
          next_due_date: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          category?: string
          created_at?: string
          created_by: string
          day_of_month?: number | null
          description?: string | null
          frequency?: string
          group_id: string
          id?: string
          last_generated_at?: string | null
          next_due_date: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          day_of_month?: number | null
          description?: string | null
          frequency?: string
          group_id?: string
          id?: string
          last_generated_at?: string | null
          next_due_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          created_at: string
          id: string
          list_id: string
          name: string
          purchased: boolean
          purchased_at: string | null
          purchased_by: string | null
          quantity: number
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          name: string
          purchased?: boolean
          purchased_at?: string | null
          purchased_by?: string | null
          quantity?: number
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          name?: string
          purchased?: boolean
          purchased_at?: string | null
          purchased_by?: string | null
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          group_id: string
          id: string
          list_type: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          list_type?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          list_type?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      group_member_profiles: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          full_name: string | null
          group_id: string | null
          id: string | null
          split_percentage: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: { Args: { _token: string }; Returns: Json }
      admin_read_cpf: { Args: { _target_user_id: string }; Returns: string }
      confirm_payment: {
        Args: { _payment_id: string; _status?: string }
        Returns: undefined
      }
      create_audit_log: {
        Args: {
          _action: string
          _details?: Json
          _entity_id?: string
          _entity_type: string
          _group_id: string
          _user_id: string
        }
        Returns: string
      }
      create_expense_with_splits: {
        Args: {
          _amount?: number
          _category?: string
          _credit_card_id?: string
          _description?: string
          _due_date?: string
          _expense_type?: string
          _group_id: string
          _installments?: number
          _payment_method?: string
          _purchase_date?: string
          _receipt_url?: string
          _recurring_expense_id?: string
          _target_user_id?: string
          _title: string
        }
        Returns: string
      }
      create_group_with_admin: {
        Args: {
          _description?: string
          _name: string
          _splitting_rule?: Database["public"]["Enums"]["splitting_rule"]
        }
        Returns: string
      }
      create_notification: {
        Args: {
          _data?: Json
          _group_id: string
          _message: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      get_member_balances: {
        Args: { _group_id: string }
        Returns: {
          balance: number
          total_owed: number
          total_paid: number
          user_id: string
        }[]
      }
      get_user_group_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role_in_group: {
        Args: {
          _group_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_of_user: {
        Args: { _admin_id: string; _target_user_id: string }
        Returns: boolean
      }
      is_member_of_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      read_my_cpf: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "morador"
      invite_status: "pending" | "accepted" | "rejected" | "expired"
      splitting_rule: "equal" | "percentage"
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
      app_role: ["admin", "morador"],
      invite_status: ["pending", "accepted", "rejected", "expired"],
      splitting_rule: ["equal", "percentage"],
    },
  },
} as const
