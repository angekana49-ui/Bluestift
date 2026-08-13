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
      class_enrollments: {
        Row: {
          adjustments_count: number
          bonus_config: Json
          class_id: string
          created_at: string
          expected_size: number | null
          id: string
          initial_size: number | null
          is_active: boolean
          is_full: boolean | null
          last_adjustment_date: string | null
          max_overflow: number
          promo_code: string | null
          school_id: string | null
          school_year_id: string | null
          student_count: number
          total_adjustments_paid: number
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustments_count?: number
          bonus_config?: Json
          class_id: string
          created_at?: string
          expected_size?: number | null
          id?: string
          initial_size?: number | null
          is_active?: boolean
          is_full?: boolean | null
          last_adjustment_date?: string | null
          max_overflow?: number
          promo_code?: string | null
          school_id?: string | null
          school_year_id?: string | null
          student_count?: number
          total_adjustments_paid?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustments_count?: number
          bonus_config?: Json
          class_id?: string
          created_at?: string
          expected_size?: number | null
          id?: string
          initial_size?: number | null
          is_active?: boolean
          is_full?: boolean | null
          last_adjustment_date?: string | null
          max_overflow?: number
          promo_code?: string | null
          school_id?: string | null
          school_year_id?: string | null
          student_count?: number
          total_adjustments_paid?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_promo_code_fkey"
            columns: ["promo_code"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "class_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      data_requests: {
        Row: {
          channel: string
          completed_at: string | null
          id: string
          kind: string
          note: string | null
          outcome: string | null
          requested_at: string
          subject_user_id: string
        }
        Insert: {
          channel?: string
          completed_at?: string | null
          id?: string
          kind: string
          note?: string | null
          outcome?: string | null
          requested_at?: string
          subject_user_id: string
        }
        Update: {
          channel?: string
          completed_at?: string | null
          id?: string
          kind?: string
          note?: string | null
          outcome?: string | null
          requested_at?: string
          subject_user_id?: string
        }
        Relationships: []
      }
      email_usage_windows: {
        Row: {
          created_at: string
          file_uploads_used: number
          tokens_used: number
          updated_at: string
          user_id: string
          window_key: string
          window_started_at: string
        }
        Insert: {
          created_at?: string
          file_uploads_used?: number
          tokens_used?: number
          updated_at?: string
          user_id: string
          window_key: string
          window_started_at?: string
        }
        Update: {
          created_at?: string
          file_uploads_used?: number
          tokens_used?: number
          updated_at?: string
          user_id?: string
          window_key?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_usage_windows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_events: {
        Row: {
          id: string
          metadata: Json | null
          occurred_at: string
          step: string
          user_id: string
        }
        Insert: {
          id?: string
          metadata?: Json | null
          occurred_at?: string
          step: string
          user_id: string
        }
        Update: {
          id?: string
          metadata?: Json | null
          occurred_at?: string
          step?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          applicable_plans: Json | null
          bonus_duration_days: number | null
          bonus_features: Json
          code: string
          created_at: string
          current_uses: number
          description: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          is_active: boolean
          max_uses: number | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          applicable_plans?: Json | null
          bonus_duration_days?: number | null
          bonus_features?: Json
          code: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          applicable_plans?: Json | null
          bonus_duration_days?: number | null
          bonus_features?: Json
          code?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      user_promo_code_redemptions: {
        Row: {
          code: string | null
          id: string
          metadata: Json
          promo_code_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code?: string | null
          id?: string
          metadata?: Json
          promo_code_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code?: string | null
          id?: string
          metadata?: Json
          promo_code_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_promo_code_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_promo_code_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_state: string
          account_type: string
          auth_method: string
          birth_year: number | null
          age_declared_at: string | null
          minor_consent_source: string | null
          minor_consent_at: string | null
          minor_consent_note: string | null
          class_enrollment_id: string | null
          created_at: string
          daily_message_count: number
          display_name: string | null
          email: string | null
          email_verified_at: string | null
          id: string
          is_founder: boolean
          last_activity_at: string | null
          last_message_date: string | null
          onboarding_completed_at: string | null
          profile_picture_url: string | null
          recovery_code: string | null
          role: string
          school_id: string | null
          school_level: string | null
          school_year_id: string | null
          training_consent: boolean
          training_consent_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          account_state?: string
          account_type?: string
          auth_method?: string
          birth_year?: number | null
          age_declared_at?: string | null
          minor_consent_source?: string | null
          minor_consent_at?: string | null
          minor_consent_note?: string | null
          class_enrollment_id?: string | null
          created_at?: string
          daily_message_count?: number
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          id: string
          is_founder?: boolean
          last_activity_at?: string | null
          last_message_date?: string | null
          onboarding_completed_at?: string | null
          profile_picture_url?: string | null
          recovery_code?: string | null
          role?: string
          school_id?: string | null
          school_level?: string | null
          school_year_id?: string | null
          training_consent?: boolean
          training_consent_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_state?: string
          account_type?: string
          auth_method?: string
          birth_year?: number | null
          age_declared_at?: string | null
          minor_consent_source?: string | null
          minor_consent_at?: string | null
          minor_consent_note?: string | null
          class_enrollment_id?: string | null
          created_at?: string
          daily_message_count?: number
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          id?: string
          is_founder?: boolean
          last_activity_at?: string | null
          last_message_date?: string | null
          onboarding_completed_at?: string | null
          profile_picture_url?: string | null
          recovery_code?: string | null
          role?: string
          school_id?: string | null
          school_level?: string | null
          school_year_id?: string | null
          training_consent?: boolean
          training_consent_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_enrollment_fk"
            columns: ["class_enrollment_id"]
            isOneToOne: false
            referencedRelation: "class_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_god: { Args: never; Returns: boolean }
      is_room_member: { Args: { p_room_id: string }; Returns: boolean }
      is_school_admin: { Args: { p_school_id: string }; Returns: boolean }
      room_roster: {
        Args: { p_room_id: string }
        Returns: {
          user_id: string
          display_name: string | null
          username: string | null
          role: string
          profile_picture_url: string | null
        }[]
      }
      challenge_leaderboard: {
        Args: { p_challenge_id: string }
        Returns: {
          user_id: string
          display_name: string | null
          username: string | null
          score: number | null
          status: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  learning: {
    Tables: {
      shares: {
        Row: {
          id: string
          token: string
          user_id: string
          kind: string
          title: string | null
          body: string | null
          brand: string
          created_at: string
          revoked_at: string | null
        }
        Insert: {
          id?: string
          token: string
          user_id: string
          kind?: string
          title?: string | null
          body?: string | null
          brand?: string
          created_at?: string
          revoked_at?: string | null
        }
        Update: {
          id?: string
          token?: string
          user_id?: string
          kind?: string
          title?: string | null
          body?: string | null
          brand?: string
          created_at?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      student_simulations: {
        Row: {
          id: string
          user_id: string
          focus: string | null
          add_hours: number
          result: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          focus?: string | null
          add_hours: number
          result: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          focus?: string | null
          add_hours?: number
          result?: Json
          created_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          session_id: string | null
          class_enrollment_id: string | null
          room_id: string | null
          is_private_room_channel: boolean
          school_id: string | null
          title: string | null
          subject: string | null
          subject_detected: string | null
          difficulty: string | null
          context_type: string
          is_active: boolean
          message_count: number
          kernel_triggered: boolean
          is_training_eligible: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id?: string | null
          class_enrollment_id?: string | null
          room_id?: string | null
          is_private_room_channel?: boolean
          school_id?: string | null
          title?: string | null
          subject?: string | null
          subject_detected?: string | null
          difficulty?: string | null
          context_type?: string
          is_active?: boolean
          message_count?: number
          kernel_triggered?: boolean
          is_training_eligible?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string | null
          class_enrollment_id?: string | null
          room_id?: string | null
          is_private_room_channel?: boolean
          school_id?: string | null
          title?: string | null
          subject?: string | null
          subject_detected?: string | null
          difficulty?: string | null
          context_type?: string
          is_active?: boolean
          message_count?: number
          kernel_triggered?: boolean
          is_training_eligible?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          user_id: string | null
          role: string
          content: string | null
          has_media: boolean
          response_time_ms: number | null
          model_used: string | null
          tokens_used: number | null
          action_type: string | null
          parent_id: string | null
          blocage_type: string | null
          langue_interaction: string | null
          partial_credit_score: number | null
          is_assisted: boolean
          concept_id: string | null
          emt_level: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id?: string | null
          role: string
          content?: string | null
          has_media?: boolean
          response_time_ms?: number | null
          model_used?: string | null
          tokens_used?: number | null
          action_type?: string | null
          parent_id?: string | null
          blocage_type?: string | null
          langue_interaction?: string | null
          partial_credit_score?: number | null
          is_assisted?: boolean
          concept_id?: string | null
          emt_level?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string | null
          role?: string
          content?: string | null
          has_media?: boolean
          response_time_ms?: number | null
          model_used?: string | null
          tokens_used?: number | null
          action_type?: string | null
          parent_id?: string | null
          blocage_type?: string | null
          langue_interaction?: string | null
          partial_credit_score?: number | null
          is_assisted?: boolean
          concept_id?: string | null
          emt_level?: string | null
          created_at?: string
        }
        Relationships: []
      }
      tool_outputs: {
        Row: {
          id: string
          user_id: string
          source_media_id: string | null
          conversation_id: string | null
          tool_type: string
          status: string
          error_message: string | null
          output_url: string | null
          output_content: Json
          concept_ids: string[] | null
          kernel_processed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_media_id?: string | null
          conversation_id?: string | null
          tool_type: string
          status?: string
          error_message?: string | null
          output_url?: string | null
          output_content?: Json
          concept_ids?: string[] | null
          kernel_processed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_media_id?: string | null
          conversation_id?: string | null
          tool_type?: string
          status?: string
          error_message?: string | null
          output_url?: string | null
          output_content?: Json
          concept_ids?: string[] | null
          kernel_processed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          id: string
          name: string
          created_by: string | null
          subject: string | null
          mission: string | null
          status: string
          visibility: string
          max_members: number
          online_count: number
          ai_mode: string
          timer_status: string
          timer_started_at: string | null
          timer_ends_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by?: string | null
          subject?: string | null
          mission?: string | null
          status?: string
          visibility?: string
          max_members?: number
          online_count?: number
          ai_mode?: string
          timer_status?: string
          timer_started_at?: string | null
          timer_ends_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_by?: string | null
          subject?: string | null
          mission?: string | null
          status?: string
          visibility?: string
          max_members?: number
          online_count?: number
          ai_mode?: string
          timer_status?: string
          timer_started_at?: string | null
          timer_ends_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      room_members: {
        Row: {
          id: string
          room_id: string
          user_id: string
          role: string
          is_online: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          role?: string
          is_online?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          role?: string
          is_online?: boolean
          joined_at?: string
        }
        Relationships: []
      }
      room_messages: {
        Row: {
          id: string
          room_id: string
          user_id: string | null
          role: string
          content: string | null
          has_media: boolean
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id?: string | null
          role: string
          content?: string | null
          has_media?: boolean
          parent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string | null
          role?: string
          content?: string | null
          has_media?: boolean
          parent_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          id: string
          room_id: string | null
          created_by: string | null
          title: string | null
          description: string | null
          subject: string | null
          format: string | null
          scope: string | null
          duration_seconds: number | null
          question_count: number | null
          status: string
          deadline_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          room_id?: string | null
          created_by?: string | null
          title?: string | null
          description?: string | null
          subject?: string | null
          format?: string | null
          scope?: string | null
          duration_seconds?: number | null
          question_count?: number | null
          status?: string
          deadline_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string | null
          created_by?: string | null
          title?: string | null
          description?: string | null
          subject?: string | null
          format?: string | null
          scope?: string | null
          duration_seconds?: number | null
          question_count?: number | null
          status?: string
          deadline_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      challenge_questions: {
        Row: {
          id: string
          challenge_id: string
          concept_id: string | null
          content: string | null
          type: string | null
          options: Json
          correct_answer: string | null
          order: number | null
        }
        Insert: {
          id?: string
          challenge_id: string
          concept_id?: string | null
          content?: string | null
          type?: string | null
          options?: Json
          correct_answer?: string | null
          order?: number | null
        }
        Update: {
          id?: string
          challenge_id?: string
          concept_id?: string | null
          content?: string | null
          type?: string | null
          options?: Json
          correct_answer?: string | null
          order?: number | null
        }
        Relationships: []
      }
      challenge_attempts: {
        Row: {
          id: string
          challenge_id: string
          user_id: string
          score: number | null
          time_used_seconds: number | null
          pauses_used: number
          status: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          challenge_id: string
          user_id: string
          score?: number | null
          time_used_seconds?: number | null
          pauses_used?: number
          status?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          challenge_id?: string
          user_id?: string
          score?: number | null
          time_used_seconds?: number | null
          pauses_used?: number
          status?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      challenge_answers: {
        Row: {
          id: string
          attempt_id: string
          question_id: string
          answer_text: string | null
          is_correct: boolean | null
          raya_feedback: string | null
          response_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          attempt_id: string
          question_id: string
          answer_text?: string | null
          is_correct?: boolean | null
          raya_feedback?: string | null
          response_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          attempt_id?: string
          question_id?: string
          answer_text?: string | null
          is_correct?: boolean | null
          raya_feedback?: string | null
          response_time_ms?: number | null
          created_at?: string
        }
        Relationships: []
      }
      room_reports: {
        Row: {
          id: string
          room_id: string
          scope: string
          summary: string | null
          key_learnings: string | null
          highlights: Json
          recommendations: string | null
          squad_score: number | null
          kernel_version: string | null
          visible_to_school: boolean
          url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          scope?: string
          summary?: string | null
          key_learnings?: string | null
          highlights?: Json
          recommendations?: string | null
          squad_score?: number | null
          kernel_version?: string | null
          visible_to_school?: boolean
          url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          scope?: string
          summary?: string | null
          key_learnings?: string | null
          highlights?: Json
          recommendations?: string | null
          squad_score?: number | null
          kernel_version?: string | null
          visible_to_school?: boolean
          url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      room_files: {
        Row: {
          id: string
          room_id: string
          message_id: string | null
          file_name: string | null
          file_path: string | null
          file_url: string | null
          file_type: string | null
          mime_type: string | null
          file_size: number | null
          uploader_id: string | null
          content: string | null
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          message_id?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          file_type?: string | null
          mime_type?: string | null
          file_size?: number | null
          uploader_id?: string | null
          content?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          message_id?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          file_type?: string | null
          mime_type?: string | null
          file_size?: number | null
          uploader_id?: string | null
          content?: string | null
          created_at?: string
        }
        Relationships: []
      }
      conversation_files: {
        Row: {
          id: string
          conversation_id: string
          message_id: string | null
          file_name: string | null
          file_path: string | null
          file_url: string | null
          file_type: string | null
          mime_type: string | null
          file_size: number | null
          uploader_id: string | null
          content: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          message_id?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          file_type?: string | null
          mime_type?: string | null
          file_size?: number | null
          uploader_id?: string | null
          content?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          message_id?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          file_type?: string | null
          mime_type?: string | null
          file_size?: number | null
          uploader_id?: string | null
          content?: string | null
          created_at?: string
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  rag: {
    Tables: {
      user_media: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          room_id: string | null
          url: string | null
          type: string | null
          title: string | null
          size_bytes: number | null
          embedding_status: string
          extracted_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          conversation_id?: string | null
          room_id?: string | null
          url?: string | null
          type?: string | null
          title?: string | null
          size_bytes?: number | null
          embedding_status?: string
          extracted_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string | null
          room_id?: string | null
          url?: string | null
          type?: string | null
          title?: string | null
          size_bytes?: number | null
          embedding_status?: string
          extracted_text?: string | null
          created_at?: string
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// NOTE: Only the `public` schema is emitted above because PostgREST only
// exposes `public` by default. The `learning`, `schools`, `rag`, `content`
// and `kernel` schemas exist in the database but must be added to the API's
// "Exposed schemas" (Dashboard > Project Settings > API) before supabase-js
// can query them via `.schema('learning')` etc. Re-run type generation after
// exposing them to get full typings.

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
    Enums: {},
  },
} as const
