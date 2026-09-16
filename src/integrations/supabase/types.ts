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
      alerts: {
        Row: {
          asset_id: string
          created_at: string
          email_error: string | null
          email_sent_at: string | null
          email_status: Database["public"]["Enums"]["alert_email_status"]
          id: string
          message: string
          metadata: Json
          movement_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["alert_status"]
          type: Database["public"]["Enums"]["alert_type"]
        }
        Insert: {
          asset_id: string
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: Database["public"]["Enums"]["alert_email_status"]
          id?: string
          message: string
          metadata?: Json
          movement_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          type: Database["public"]["Enums"]["alert_type"]
        }
        Update: {
          asset_id?: string
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: Database["public"]["Enums"]["alert_email_status"]
          id?: string
          message?: string
          metadata?: Json
          movement_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          type?: Database["public"]["Enums"]["alert_type"]
        }
        Relationships: [
          {
            foreignKeyName: "alerts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_number: string
          category: string | null
          condition: Database["public"]["Enums"]["asset_condition"]
          created_at: string
          created_by: string
          created_by_email: string | null
          current_site_id: string
          id: string
          last_movement_at: string | null
          model: string | null
          photo_url: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
        }
        Insert: {
          asset_number: string
          category?: string | null
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          created_by?: string
          created_by_email?: string | null
          current_site_id: string
          id?: string
          last_movement_at?: string | null
          model?: string | null
          photo_url?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
        }
        Update: {
          asset_number?: string
          category?: string | null
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          created_by?: string
          created_by_email?: string | null
          current_site_id?: string
          id?: string
          last_movement_at?: string | null
          model?: string | null
          photo_url?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_current_site_id_fkey"
            columns: ["current_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_sites: {
        Row: {
          active: boolean
          created_at: string
          engineer_id: string
          id: string
          site_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          engineer_id: string
          id?: string
          site_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          engineer_id?: string
          id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_sites_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          action: Database["public"]["Enums"]["movement_action"]
          asset_id: string
          asset_number: string
          client_operation_id: string
          condition: Database["public"]["Enums"]["asset_condition"]
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          occurred_at: string
          performed_by: string
          performed_by_email: string | null
          photo_url: string | null
          previous_condition:
            | Database["public"]["Enums"]["asset_condition"]
            | null
          previous_site_id: string | null
          previous_site_name: string | null
          previous_status: Database["public"]["Enums"]["asset_status"] | null
          protocol_omission: boolean
          site_id: string
          site_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["movement_action"]
          asset_id: string
          asset_number: string
          client_operation_id: string
          condition: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          occurred_at?: string
          performed_by: string
          performed_by_email?: string | null
          photo_url?: string | null
          previous_condition?:
            | Database["public"]["Enums"]["asset_condition"]
            | null
          previous_site_id?: string | null
          previous_site_name?: string | null
          previous_status?: Database["public"]["Enums"]["asset_status"] | null
          protocol_omission?: boolean
          site_id: string
          site_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["movement_action"]
          asset_id?: string
          asset_number?: string
          client_operation_id?: string
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          occurred_at?: string
          performed_by?: string
          performed_by_email?: string | null
          photo_url?: string | null
          previous_condition?:
            | Database["public"]["Enums"]["asset_condition"]
            | null
          previous_site_id?: string | null
          previous_site_name?: string | null
          previous_status?: Database["public"]["Enums"]["asset_status"] | null
          protocol_omission?: boolean
          site_id?: string
          site_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_previous_site_id_fkey"
            columns: ["previous_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_engineer_sites: {
        Row: {
          active: boolean
          created_at: string
          id: string
          pending_engineer_id: string
          site_id: string
          source: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          pending_engineer_id: string
          site_id: string
          source?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          pending_engineer_id?: string
          site_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_engineer_sites_pending_engineer_id_fkey"
            columns: ["pending_engineer_id"]
            isOneToOne: false
            referencedRelation: "pending_engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_engineer_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_engineers: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          source: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          source: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      alerts_dashboard: {
        Args: never
        Returns: {
          assets_in_transit: number
          open_alerts: number
          protocol_omissions: number
          transit_48h: number
        }[]
      }
      dashboard_metrics: {
        Args: { _from?: string; _to?: string }
        Returns: Json
      }
      export_inventory_page: {
        Args: {
          _after_id?: string
          _asset_number?: string
          _condition?: string
          _limit?: number
          _model?: string
          _serial_number?: string
          _site_id?: string
          _status?: string
        }
        Returns: {
          asset_number: string
          category: string
          condition: string
          created_at: string
          id: string
          last_movement_at: string
          model: string
          serial_number: string
          site_name: string
          status: string
        }[]
      }
      export_movements_page: {
        Args: {
          _action?: string
          _after_occurred_at?: string
          _after_row_id?: string
          _asset_number?: string
          _condition?: string
          _from?: string
          _limit?: number
          _omission?: boolean
          _site_id?: string
          _to?: string
          _user_id?: string
        }
        Returns: {
          action: string
          asset_number: string
          condition: string
          latitude: number
          longitude: number
          model: string
          notes: string
          occurred_at: string
          protocol_omission: boolean
          row_id: string
          serial_number: string
          site_name: string
          user_email: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assigned_site: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
      list_alerts: {
        Args: { _limit?: number; _offset?: number; _status?: string }
        Returns: {
          asset_id: string
          asset_number: string
          created_at: string
          departed_at: string
          email_error: string
          email_sent_at: string
          email_status: Database["public"]["Enums"]["alert_email_status"]
          hours_in_transit: number
          id: string
          message: string
          metadata: Json
          movement_id: string
          origin_site_name: string
          resolution_notes: string
          resolved_at: string
          resolved_by_email: string
          site_id: string
          site_name: string
          status: Database["public"]["Enums"]["alert_status"]
          subsequent_entry_at: string
          total_count: number
          type: Database["public"]["Enums"]["alert_type"]
        }[]
      }
      list_asset_alerts: {
        Args: { _asset_id: string }
        Returns: {
          created_at: string
          id: string
          message: string
          resolved_at: string
          status: Database["public"]["Enums"]["alert_status"]
          type: Database["public"]["Enums"]["alert_type"]
        }[]
      }
      lookup_asset_for_scan: {
        Args: { _code: string }
        Returns: {
          asset_number: string
          condition: Database["public"]["Enums"]["asset_condition"]
          current_site_id: string
          current_site_name: string
          id: string
          last_movement_at: string
          matched_by: string
          model: string
          photo_url: string
          serial_number: string
          status: Database["public"]["Enums"]["asset_status"]
        }[]
      }
      register_movement: {
        Args: {
          _action: string
          _asset_id: string
          _client_operation_id: string
          _condition?: string
          _latitude?: number
          _longitude?: number
          _notes?: string
          _photo_url?: string
          _site_id: string
        }
        Returns: {
          duplicate: boolean
          movement_id: string
          new_site_id: string
          new_status: Database["public"]["Enums"]["asset_status"]
          protocol_omission: boolean
        }[]
      }
      report_inventory: {
        Args: {
          _asset_number?: string
          _condition?: string
          _limit?: number
          _model?: string
          _offset?: number
          _serial_number?: string
          _site_id?: string
          _status?: string
        }
        Returns: {
          asset_number: string
          category: string
          condition: string
          created_at: string
          id: string
          last_movement_at: string
          model: string
          serial_number: string
          site_id: string
          site_name: string
          status: string
          total_count: number
        }[]
      }
      report_movements: {
        Args: {
          _action?: string
          _asset_number?: string
          _condition?: string
          _from?: string
          _limit?: number
          _offset?: number
          _omission?: boolean
          _site_id?: string
          _to?: string
          _user_id?: string
        }
        Returns: {
          action: string
          asset_id: string
          asset_number: string
          condition: string
          has_gps: boolean
          has_photo: boolean
          latitude: number
          longitude: number
          model: string
          notes: string
          occurred_at: string
          protocol_omission: boolean
          resulting_status: string
          row_id: string
          serial_number: string
          site_id: string
          site_name: string
          total_count: number
          user_email: string
        }[]
      }
      resolve_alert: {
        Args: { _alert_id: string; _notes: string }
        Returns: {
          id: string
          resolved_at: string
          status: Database["public"]["Enums"]["alert_status"]
        }[]
      }
      run_transit_48h_check: {
        Args: never
        Returns: {
          alerts_created: number
          alerts_existing: number
          assets_reviewed: number
          created_ids: string[]
          errors: number
        }[]
      }
      site_asset_counts: {
        Args: { _site_id: string }
        Returns: {
          activos: number
          danados: number
          desconectados: number
          en_transito: number
          total: number
        }[]
      }
    }
    Enums: {
      alert_email_status: "PENDING" | "SENT" | "FAILED"
      alert_status: "OPEN" | "RESOLVED"
      alert_type: "TRANSITO_48H" | "OMISION_PROTOCOLO"
      app_role: "admin" | "engineer"
      asset_condition: "ACTIVO" | "DESCONECTADO" | "DANADO"
      asset_status: "EN_SITIO" | "EN_TRANSITO"
      movement_action: "ENTRADA" | "SALIDA" | "INVENTARIO"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      alert_email_status: ["PENDING", "SENT", "FAILED"],
      alert_status: ["OPEN", "RESOLVED"],
      alert_type: ["TRANSITO_48H", "OMISION_PROTOCOLO"],
      app_role: ["admin", "engineer"],
      asset_condition: ["ACTIVO", "DESCONECTADO", "DANADO"],
      asset_status: ["EN_SITIO", "EN_TRANSITO"],
      movement_action: ["ENTRADA", "SALIDA", "INVENTARIO"],
    },
  },
} as const
