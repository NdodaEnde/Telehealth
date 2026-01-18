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
      appointments: {
        Row: {
          clinician_id: string
          consultation_type: Database["public"]["Enums"]["consultation_type"]
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          patient_id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          symptom_assessment_id: string | null
          updated_at: string
        }
        Insert: {
          clinician_id: string
          consultation_type?: Database["public"]["Enums"]["consultation_type"]
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          symptom_assessment_id?: string | null
          updated_at?: string
        }
        Update: {
          clinician_id?: string
          consultation_type?: Database["public"]["Enums"]["consultation_type"]
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          symptom_assessment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinician_id_fkey"
            columns: ["clinician_id"]
            isOneToOne: false
            referencedRelation: "clinician_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_symptom_assessment_id_fkey"
            columns: ["symptom_assessment_id"]
            isOneToOne: false
            referencedRelation: "symptom_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          appointment_id: string
          chief_complaint: string | null
          clinician_id: string
          created_at: string
          diagnosis: string[] | null
          examination_findings: string | null
          follow_up_date: string | null
          follow_up_instructions: string | null
          history_of_present_illness: string | null
          icd10_codes: Json | null
          id: string
          patient_id: string
          prescriptions: Json | null
          referral_details: string | null
          referral_required: boolean | null
          signed_at: string | null
          status: string
          treatment_plan: string | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          chief_complaint?: string | null
          clinician_id: string
          created_at?: string
          diagnosis?: string[] | null
          examination_findings?: string | null
          follow_up_date?: string | null
          follow_up_instructions?: string | null
          history_of_present_illness?: string | null
          icd10_codes?: Json | null
          id?: string
          patient_id: string
          prescriptions?: Json | null
          referral_details?: string | null
          referral_required?: boolean | null
          signed_at?: string | null
          status?: string
          treatment_plan?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          chief_complaint?: string | null
          clinician_id?: string
          created_at?: string
          diagnosis?: string[] | null
          examination_findings?: string | null
          follow_up_date?: string | null
          follow_up_instructions?: string | null
          history_of_present_illness?: string | null
          icd10_codes?: Json | null
          id?: string
          patient_id?: string
          prescriptions?: Json | null
          referral_details?: string | null
          referral_required?: boolean | null
          signed_at?: string | null
          status?: string
          treatment_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      clinician_availability: {
        Row: {
          clinician_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          updated_at: string
        }
        Insert: {
          clinician_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          updated_at?: string
        }
        Update: {
          clinician_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinician_availability_clinician_id_fkey"
            columns: ["clinician_id"]
            isOneToOne: false
            referencedRelation: "clinician_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinician_profiles: {
        Row: {
          bio: string | null
          created_at: string
          hpcsa_number: string | null
          id: string
          is_available: boolean | null
          qualification: string | null
          specialization: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          hpcsa_number?: string | null
          id: string
          is_available?: boolean | null
          qualification?: string | null
          specialization?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          hpcsa_number?: string | null
          id?: string
          is_available?: boolean | null
          qualification?: string | null
          specialization?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      consultation_messages: {
        Row: {
          content: string
          created_at: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          message_type: string
          sender_id: string
          sender_role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          message_type?: string
          sender_id: string
          sender_role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          message_type?: string
          sender_id?: string
          sender_role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "consultation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_sessions: {
        Row: {
          appointment_id: string
          clinician_id: string
          clinician_joined_at: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          patient_id: string
          patient_joined_at: string | null
          status: string
        }
        Insert: {
          appointment_id: string
          clinician_id: string
          clinician_joined_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          patient_id: string
          patient_joined_at?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string
          clinician_id?: string
          clinician_joined_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          patient_id?: string
          patient_joined_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string
          id: string
          id_number: string | null
          last_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name: string
          id: string
          id_number?: string | null
          last_name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string
          id?: string
          id_number?: string | null
          last_name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      symptom_assessments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          patient_id: string
          recommended_specialization: string | null
          severity: Database["public"]["Enums"]["symptom_severity"]
          symptoms: string[]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          patient_id: string
          recommended_specialization?: string | null
          severity?: Database["public"]["Enums"]["symptom_severity"]
          symptoms: string[]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          patient_id?: string
          recommended_specialization?: string | null
          severity?: Database["public"]["Enums"]["symptom_severity"]
          symptoms?: string[]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "patient" | "nurse" | "doctor" | "admin"
      appointment_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "cancelled"
        | "completed"
      consultation_type: "video" | "phone" | "in_person"
      symptom_severity: "mild" | "moderate" | "severe"
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
      app_role: ["patient", "nurse", "doctor", "admin"],
      appointment_status: [
        "pending",
        "confirmed",
        "in_progress",
        "cancelled",
        "completed",
      ],
      consultation_type: ["video", "phone", "in_person"],
      symptom_severity: ["mild", "moderate", "severe"],
    },
  },
} as const
