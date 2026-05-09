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
      claim_requests: {
        Row: {
          company_id: string
          created_at: string
          email: string
          id: string
          message: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          claimed_by: string | null
          created_at: string
          description: string | null
          employee_count: string | null
          full_address: string | null
          hiring_status: boolean
          id: string
          is_claimed: boolean
          is_verified: boolean
          latitude: number | null
          linkedin_url: string | null
          logo_url: string | null
          longitude: number | null
          name: string
          photos: string[] | null
          sector: string | null
          stage: string | null
          status: string
          submitted_by: string | null
          updated_at: string
          website: string | null
          year_founded: number | null
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          description?: string | null
          employee_count?: string | null
          full_address?: string | null
          hiring_status?: boolean
          id?: string
          is_claimed?: boolean
          is_verified?: boolean
          latitude?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          photos?: string[] | null
          sector?: string | null
          stage?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          website?: string | null
          year_founded?: number | null
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          description?: string | null
          employee_count?: string | null
          full_address?: string | null
          hiring_status?: boolean
          id?: string
          is_claimed?: boolean
          is_verified?: boolean
          latitude?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          photos?: string[] | null
          sector?: string | null
          stage?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          website?: string | null
          year_founded?: number | null
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          title: string
          description: string | null
          url: string | null
          source: string
          source_id: string | null
          start_date: string | null
          end_date: string | null
          location_name: string | null
          is_online: boolean
          image_url: string | null
          organizer: string | null
          industries: string[]
          stages: string[]
          topics: string[]
          is_active: boolean
          scraped_at: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          url?: string | null
          source: string
          source_id?: string | null
          start_date?: string | null
          end_date?: string | null
          location_name?: string | null
          is_online?: boolean
          image_url?: string | null
          organizer?: string | null
          industries?: string[]
          stages?: string[]
          topics?: string[]
          is_active?: boolean
          scraped_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          url?: string | null
          source?: string
          source_id?: string | null
          start_date?: string | null
          end_date?: string | null
          location_name?: string | null
          is_online?: boolean
          image_url?: string | null
          organizer?: string | null
          industries?: string[]
          stages?: string[]
          topics?: string[]
          is_active?: boolean
          scraped_at?: string
          created_at?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          ai_imported: boolean
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location: string | null
          title: string
          type: string | null
          url: string | null
        }
        Insert: {
          ai_imported?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          title: string
          type?: string | null
          url?: string | null
        }
        Update: {
          ai_imported?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          title?: string
          type?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      navigator_sessions: {
        Row: {
          created_at: string
          id: string
          recommendations: Json | null
          session_data: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          recommendations?: Json | null
          session_data?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          recommendations?: Json | null
          session_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          communities: string[] | null
          created_at: string
          description: string | null
          email: string | null
          external_id: string | null
          id: string
          image_url: string | null
          industries: string[] | null
          is_active: boolean
          link: string | null
          locations: string[] | null
          title: string
          topics: string[] | null
          updated_at: string
        }
        Insert: {
          communities?: string[] | null
          created_at?: string
          description?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          industries?: string[] | null
          is_active?: boolean
          link?: string | null
          locations?: string[] | null
          title: string
          topics?: string[] | null
          updated_at?: string
        }
        Update: {
          communities?: string[] | null
          created_at?: string
          description?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          industries?: string[] | null
          is_active?: boolean
          link?: string | null
          locations?: string[] | null
          title?: string
          topics?: string[] | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "founder" | "investor"
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
      app_role: ["admin", "founder", "investor"],
    },
  },
} as const
