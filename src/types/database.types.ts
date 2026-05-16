export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cached_botanical_records: {
        Row: {
          cached_at: string
          common_name: string
          ideal_max_ph: number | null
          ideal_min_ph: number | null
          is_ai_enriched: boolean
          is_toxic_to_pets: boolean | null
          perenual_id: number | null
          propagation_methods: string[] | null
          raw_api_payload: Json | null
          scientific_name: string
        }
        Insert: {
          cached_at?: string
          common_name: string
          ideal_max_ph?: number | null
          ideal_min_ph?: number | null
          is_ai_enriched?: boolean
          is_toxic_to_pets?: boolean | null
          perenual_id?: number | null
          propagation_methods?: string[] | null
          raw_api_payload?: Json | null
          scientific_name: string
        }
        Update: {
          cached_at?: string
          common_name?: string
          ideal_max_ph?: number | null
          ideal_min_ph?: number | null
          is_ai_enriched?: boolean
          is_toxic_to_pets?: boolean | null
          perenual_id?: number | null
          propagation_methods?: string[] | null
          raw_api_payload?: Json | null
          scientific_name?: string
        }
        Relationships: []
      }
      plant_journals: {
        Row: {
          category: Database["public"]["Enums"]["log_category_type"]
          id: string
          image_storage_path: string | null
          logged_at: string
          notes: string | null
          plant_id: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["log_category_type"]
          id?: string
          image_storage_path?: string | null
          logged_at?: string
          notes?: string | null
          plant_id: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["log_category_type"]
          id?: string
          image_storage_path?: string | null
          logged_at?: string
          notes?: string | null
          plant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_journals_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_journals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          common_name: string
          container_vector: Database["public"]["Enums"]["container_vector_type"]
          created_at: string
          current_snooze_interval_days: number
          id: string
          last_checked_at: string | null
          next_check_due_at: string
          perenual_id: number | null
          scientific_name: string | null
          substrate_factor: Database["public"]["Enums"]["substrate_factor_type"]
          updated_at: string
          user_id: string
          zone_id: string
        }
        Insert: {
          common_name: string
          container_vector?: Database["public"]["Enums"]["container_vector_type"]
          created_at?: string
          current_snooze_interval_days?: number
          id?: string
          last_checked_at?: string | null
          next_check_due_at?: string
          perenual_id?: number | null
          scientific_name?: string | null
          substrate_factor?: Database["public"]["Enums"]["substrate_factor_type"]
          updated_at?: string
          user_id: string
          zone_id: string
        }
        Update: {
          common_name?: string
          container_vector?: Database["public"]["Enums"]["container_vector_type"]
          created_at?: string
          current_snooze_interval_days?: number
          id?: string
          last_checked_at?: string | null
          next_check_due_at?: string
          perenual_id?: number | null
          scientific_name?: string | null
          substrate_factor?: Database["public"]["Enums"]["substrate_factor_type"]
          updated_at?: string
          user_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plants_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          created_at: string
          has_active_ventilation: boolean
          has_grow_lights: boolean
          humidity_baseline: number
          icon: string
          id: string
          name: string
          updated_at: string
          user_id: string
          window_orientation: Database["public"]["Enums"]["window_orientation_type"]
        }
        Insert: {
          created_at?: string
          has_active_ventilation?: boolean
          has_grow_lights?: boolean
          humidity_baseline?: number
          icon?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
          window_orientation?: Database["public"]["Enums"]["window_orientation_type"]
        }
        Update: {
          created_at?: string
          has_active_ventilation?: boolean
          has_grow_lights?: boolean
          humidity_baseline?: number
          icon?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          window_orientation?: Database["public"]["Enums"]["window_orientation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "zones_user_id_fkey"
            columns: ["user_id"]
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
      [_ in never]: never
    }
    Enums: {
      container_vector_type:
        | "Terracotta"
        | "Plastic"
        | "Ceramic"
        | "Fabric"
        | "Self-Watering"
        | "Ground"
      log_category_type:
        | "Observation"
        | "Pruning"
        | "Repotting"
        | "Fertilization"
        | "PestTreatment"
      substrate_factor_type:
        | "High-Drainage Aroid"
        | "Heavy Peat"
        | "Standard Potting"
        | "Desert Succulent"
        | "Sphagnum Moss Mix"
      window_orientation_type:
        | "North"
        | "South"
        | "East"
        | "West"
        | "Northeast"
        | "Northwest"
        | "Southeast"
        | "Southwest"
        | "None"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      container_vector_type: [
        "Terracotta",
        "Plastic",
        "Ceramic",
        "Fabric",
        "Self-Watering",
        "Ground",
      ],
      log_category_type: [
        "Observation",
        "Pruning",
        "Repotting",
        "Fertilization",
        "PestTreatment",
      ],
      substrate_factor_type: [
        "High-Drainage Aroid",
        "Heavy Peat",
        "Standard Potting",
        "Desert Succulent",
        "Sphagnum Moss Mix",
      ],
      window_orientation_type: [
        "North",
        "South",
        "East",
        "West",
        "Northeast",
        "Northwest",
        "Southeast",
        "Southwest",
        "None",
      ],
    },
  },
} as const

