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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      feedback: {
        Row: {
          created_at: string
          feedback_type: string
          id: string
          message: string
          rating: number | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
          verification_id: string | null
        }
        Insert: {
          created_at?: string
          feedback_type: string
          id?: string
          message: string
          rating?: number | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
          verification_id?: string | null
        }
        Update: {
          created_at?: string
          feedback_type?: string
          id?: string
          message?: string
          rating?: number | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
          verification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          total_verifications: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          total_verifications?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          total_verifications?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trending_topics: {
        Row: {
          average_accuracy: number | null
          created_at: string | null
          id: string
          last_updated: string | null
          topic_name: string
          trend_direction: string | null
          verification_count: number | null
        }
        Insert: {
          average_accuracy?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          topic_name: string
          trend_direction?: string | null
          verification_count?: number | null
        }
        Update: {
          average_accuracy?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          topic_name?: string
          trend_direction?: string | null
          verification_count?: number | null
        }
        Relationships: []
      }
      verifications: {
        Row: {
          ai_analysis: Json | null
          confidence_score: number
          content_text: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          content_url: string | null
          created_at: string | null
          explanation: string | null
          id: string
          is_trending: boolean | null
          sources: Json | null
          user_id: string | null
          verdict: Database["public"]["Enums"]["verification_verdict"]
        }
        Insert: {
          ai_analysis?: Json | null
          confidence_score: number
          content_text?: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          content_url?: string | null
          created_at?: string | null
          explanation?: string | null
          id?: string
          is_trending?: boolean | null
          sources?: Json | null
          user_id?: string | null
          verdict: Database["public"]["Enums"]["verification_verdict"]
        }
        Update: {
          ai_analysis?: Json | null
          confidence_score?: number
          content_text?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          content_url?: string | null
          created_at?: string | null
          explanation?: string | null
          id?: string
          is_trending?: boolean | null
          sources?: Json | null
          user_id?: string | null
          verdict?: Database["public"]["Enums"]["verification_verdict"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      content_type: "text" | "url" | "image" | "video"
      verification_verdict: "true" | "false" | "misleading" | "unverified"
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
      content_type: ["text", "url", "image", "video"],
      verification_verdict: ["true", "false", "misleading", "unverified"],
    },
  },
} as const
