export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      cached_botanical_records: {
        Row: {
          air_purifying: boolean | null;
          cached_at: string;
          care_difficulty: string | null;
          check_depth_description: string | null;
          common_name: string;
          cycle: string | null;
          description: string | null;
          flowering_season: string | null;
          fruit_season: string | null;
          growth_rate: string | null;
          human_toxicity_notes: string | null;
          ideal_humidity_max: number | null;
          ideal_humidity_min: number | null;
          ideal_max_ph: number | null;
          ideal_min_ph: number | null;
          is_ai_enriched: boolean;
          is_perenual_enriched: boolean;
          is_toxic_to_humans: boolean | null;
          is_toxic_to_pets: boolean | null;
          is_tropical: boolean | null;
          maintenance_level: string | null;
          max_height_cm: number | null;
          max_spread_cm: number | null;
          native_region: string | null;
          perenual_id: number | null;
          placement: string | null;
          plant_type: string | null;
          preferred_soil_type: string[] | null;
          produces_flowers: boolean | null;
          produces_fruit: boolean | null;
          propagation_methods: string[] | null;
          raw_api_payload: Json | null;
          regular_url: string | null;
          scientific_name: string;
          sunlight: string[] | null;
          thumbnail_fetched: boolean;
          thumbnail_url: string | null;
          toxicity_notes: string | null;
          watering: string | null;
        };
        Insert: {
          air_purifying?: boolean | null;
          cached_at?: string;
          care_difficulty?: string | null;
          check_depth_description?: string | null;
          common_name: string;
          cycle?: string | null;
          description?: string | null;
          flowering_season?: string | null;
          fruit_season?: string | null;
          growth_rate?: string | null;
          human_toxicity_notes?: string | null;
          ideal_humidity_max?: number | null;
          ideal_humidity_min?: number | null;
          ideal_max_ph?: number | null;
          ideal_min_ph?: number | null;
          is_ai_enriched?: boolean;
          is_perenual_enriched?: boolean;
          is_toxic_to_humans?: boolean | null;
          is_toxic_to_pets?: boolean | null;
          is_tropical?: boolean | null;
          maintenance_level?: string | null;
          max_height_cm?: number | null;
          max_spread_cm?: number | null;
          native_region?: string | null;
          perenual_id?: number | null;
          placement?: string | null;
          plant_type?: string | null;
          preferred_soil_type?: string[] | null;
          produces_flowers?: boolean | null;
          produces_fruit?: boolean | null;
          propagation_methods?: string[] | null;
          raw_api_payload?: Json | null;
          regular_url?: string | null;
          scientific_name: string;
          sunlight?: string[] | null;
          thumbnail_fetched?: boolean;
          thumbnail_url?: string | null;
          toxicity_notes?: string | null;
          watering?: string | null;
        };
        Update: {
          air_purifying?: boolean | null;
          cached_at?: string;
          care_difficulty?: string | null;
          check_depth_description?: string | null;
          common_name?: string;
          cycle?: string | null;
          description?: string | null;
          flowering_season?: string | null;
          fruit_season?: string | null;
          growth_rate?: string | null;
          human_toxicity_notes?: string | null;
          ideal_humidity_max?: number | null;
          ideal_humidity_min?: number | null;
          ideal_max_ph?: number | null;
          ideal_min_ph?: number | null;
          is_ai_enriched?: boolean;
          is_perenual_enriched?: boolean;
          is_toxic_to_humans?: boolean | null;
          is_toxic_to_pets?: boolean | null;
          is_tropical?: boolean | null;
          maintenance_level?: string | null;
          max_height_cm?: number | null;
          max_spread_cm?: number | null;
          native_region?: string | null;
          perenual_id?: number | null;
          placement?: string | null;
          plant_type?: string | null;
          preferred_soil_type?: string[] | null;
          produces_flowers?: boolean | null;
          produces_fruit?: boolean | null;
          propagation_methods?: string[] | null;
          raw_api_payload?: Json | null;
          regular_url?: string | null;
          scientific_name?: string;
          sunlight?: string[] | null;
          thumbnail_fetched?: boolean;
          thumbnail_url?: string | null;
          toxicity_notes?: string | null;
          watering?: string | null;
        };
        Relationships: [];
      };
      frost_date_cache: {
        Row: {
          fetched_at: string;
          first_fall_frost: string | null;
          hardiness_zone: string | null;
          id: string;
          last_spring_frost: string | null;
          latitude: number;
          longitude: number;
        };
        Insert: {
          fetched_at?: string;
          first_fall_frost?: string | null;
          hardiness_zone?: string | null;
          id?: string;
          last_spring_frost?: string | null;
          latitude: number;
          longitude: number;
        };
        Update: {
          fetched_at?: string;
          first_fall_frost?: string | null;
          hardiness_zone?: string | null;
          id?: string;
          last_spring_frost?: string | null;
          latitude?: number;
          longitude?: number;
        };
        Relationships: [];
      };
      plant_journals: {
        Row: {
          category: Database['public']['Enums']['log_category_type'];
          created_at: string;
          diagnostics: Json | null;
          id: string;
          image_storage_path: string | null;
          logged_at: string;
          notes: string | null;
          plant_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category?: Database['public']['Enums']['log_category_type'];
          created_at?: string;
          diagnostics?: Json | null;
          id?: string;
          image_storage_path?: string | null;
          logged_at?: string;
          notes?: string | null;
          plant_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: Database['public']['Enums']['log_category_type'];
          created_at?: string;
          diagnostics?: Json | null;
          id?: string;
          image_storage_path?: string | null;
          logged_at?: string;
          notes?: string | null;
          plant_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plant_journals_plant_id_fkey';
            columns: ['plant_id'];
            isOneToOne: false;
            referencedRelation: 'plants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plant_journals_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      plants: {
        Row: {
          common_name: string;
          container_vector: Database['public']['Enums']['container_vector_type'];
          created_at: string;
          current_snooze_interval_days: number;
          growth_stage: Database['public']['Enums']['growth_stage_type'];
          id: string;
          last_checked_at: string | null;
          next_check_due_at: string;
          perenual_id: number | null;
          pot_diameter_cm: number | null;
          scientific_name: string | null;
          substrate_factor: Database['public']['Enums']['substrate_factor_type'];
          updated_at: string;
          user_id: string;
          zone_id: string;
        };
        Insert: {
          common_name: string;
          container_vector?: Database['public']['Enums']['container_vector_type'];
          created_at?: string;
          current_snooze_interval_days?: number;
          growth_stage?: Database['public']['Enums']['growth_stage_type'];
          id?: string;
          last_checked_at?: string | null;
          next_check_due_at?: string;
          perenual_id?: number | null;
          pot_diameter_cm?: number | null;
          scientific_name?: string | null;
          substrate_factor?: Database['public']['Enums']['substrate_factor_type'];
          updated_at?: string;
          user_id: string;
          zone_id: string;
        };
        Update: {
          common_name?: string;
          container_vector?: Database['public']['Enums']['container_vector_type'];
          created_at?: string;
          current_snooze_interval_days?: number;
          growth_stage?: Database['public']['Enums']['growth_stage_type'];
          id?: string;
          last_checked_at?: string | null;
          next_check_due_at?: string;
          perenual_id?: number | null;
          pot_diameter_cm?: number | null;
          scientific_name?: string | null;
          substrate_factor?: Database['public']['Enums']['substrate_factor_type'];
          updated_at?: string;
          user_id?: string;
          zone_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plants_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'zones';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          has_completed_onboarding: boolean;
          id: string;
          latitude: number | null;
          location_name: string | null;
          longitude: number | null;
          push_subscription: Json | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          has_completed_onboarding?: boolean;
          id: string;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          push_subscription?: Json | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          has_completed_onboarding?: boolean;
          id?: string;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          push_subscription?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      seed_batches: {
        Row: {
          archived_at: string | null;
          brand: string | null;
          common_name: string;
          created_at: string;
          current_stage: Database['public']['Enums']['seed_stage_type'];
          germinated_at: string | null;
          id: string;
          notes: string | null;
          packet_year: number | null;
          scientific_name: string | null;
          sown_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          brand?: string | null;
          common_name: string;
          created_at?: string;
          current_stage?: Database['public']['Enums']['seed_stage_type'];
          germinated_at?: string | null;
          id?: string;
          notes?: string | null;
          packet_year?: number | null;
          scientific_name?: string | null;
          sown_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          brand?: string | null;
          common_name?: string;
          created_at?: string;
          current_stage?: Database['public']['Enums']['seed_stage_type'];
          germinated_at?: string | null;
          id?: string;
          notes?: string | null;
          packet_year?: number | null;
          scientific_name?: string | null;
          sown_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'seed_batches_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      snooze_interval_rules: {
        Row: {
          container_vector: Database['public']['Enums']['container_vector_type'];
          snooze_days: number;
          substrate_factor: Database['public']['Enums']['substrate_factor_type'];
        };
        Insert: {
          container_vector: Database['public']['Enums']['container_vector_type'];
          snooze_days: number;
          substrate_factor: Database['public']['Enums']['substrate_factor_type'];
        };
        Update: {
          container_vector?: Database['public']['Enums']['container_vector_type'];
          snooze_days?: number;
          substrate_factor?: Database['public']['Enums']['substrate_factor_type'];
        };
        Relationships: [];
      };
      weather_cache: {
        Row: {
          fetched_at: string;
          id: string;
          latitude: number;
          longitude: number;
          min_temp_next_24h: number | null;
          precipitation_probability_percent: number | null;
          relative_humidity_percent: number | null;
          temperature_celsius: number | null;
        };
        Insert: {
          fetched_at?: string;
          id?: string;
          latitude: number;
          longitude: number;
          min_temp_next_24h?: number | null;
          precipitation_probability_percent?: number | null;
          relative_humidity_percent?: number | null;
          temperature_celsius?: number | null;
        };
        Update: {
          fetched_at?: string;
          id?: string;
          latitude?: number;
          longitude?: number;
          min_temp_next_24h?: number | null;
          precipitation_probability_percent?: number | null;
          relative_humidity_percent?: number | null;
          temperature_celsius?: number | null;
        };
        Relationships: [];
      };
      zones: {
        Row: {
          created_at: string;
          has_active_ventilation: boolean;
          has_grow_lights: boolean;
          humidity_baseline: number;
          icon: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
          window_orientation: Database['public']['Enums']['window_orientation_type'];
          zone_type: string;
        };
        Insert: {
          created_at?: string;
          has_active_ventilation?: boolean;
          has_grow_lights?: boolean;
          humidity_baseline?: number;
          icon?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id: string;
          window_orientation?: Database['public']['Enums']['window_orientation_type'];
          zone_type?: string;
        };
        Update: {
          created_at?: string;
          has_active_ventilation?: boolean;
          has_grow_lights?: boolean;
          humidity_baseline?: number;
          icon?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
          window_orientation?: Database['public']['Enums']['window_orientation_type'];
          zone_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'zones_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      confirm_plant_check: {
        Args: { p_plant_id: string; p_snooze_days: number };
        Returns: undefined;
      };
      snooze_plant_check: {
        Args: { p_plant_id: string; p_snooze_days: number };
        Returns: undefined;
      };
    };
    Enums: {
      container_vector_type:
        | 'Terracotta'
        | 'Plastic'
        | 'Ceramic'
        | 'Fabric'
        | 'Self-Watering'
        | 'Ground';
      growth_stage_type: 'Seedling' | 'Juvenile' | 'Mature' | 'Dormant';
      log_category_type:
        | 'Observation'
        | 'Watering'
        | 'Pruning'
        | 'Repotting'
        | 'Fertilization'
        | 'PestTreatment';
      seed_stage_type:
        | 'Stored'
        | 'Sown Indoors'
        | 'Germinated'
        | 'Potted Up'
        | 'Hardened Off'
        | 'Transplanted Outside';
      substrate_factor_type:
        | 'High-Drainage Aroid'
        | 'Heavy Peat'
        | 'Standard Potting'
        | 'Desert Succulent'
        | 'Sphagnum Moss Mix';
      window_orientation_type:
        | 'North'
        | 'South'
        | 'East'
        | 'West'
        | 'Northeast'
        | 'Northwest'
        | 'Southeast'
        | 'Southwest'
        | 'None';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      container_vector_type: [
        'Terracotta',
        'Plastic',
        'Ceramic',
        'Fabric',
        'Self-Watering',
        'Ground',
      ],
      growth_stage_type: ['Seedling', 'Juvenile', 'Mature', 'Dormant'],
      log_category_type: [
        'Observation',
        'Watering',
        'Pruning',
        'Repotting',
        'Fertilization',
        'PestTreatment',
      ],
      seed_stage_type: [
        'Stored',
        'Sown Indoors',
        'Germinated',
        'Potted Up',
        'Hardened Off',
        'Transplanted Outside',
      ],
      substrate_factor_type: [
        'High-Drainage Aroid',
        'Heavy Peat',
        'Standard Potting',
        'Desert Succulent',
        'Sphagnum Moss Mix',
      ],
      window_orientation_type: [
        'North',
        'South',
        'East',
        'West',
        'Northeast',
        'Northwest',
        'Southeast',
        'Southwest',
        'None',
      ],
    },
  },
} as const;
