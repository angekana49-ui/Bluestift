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
  content: {
    Tables: {
      contact_messages: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_read: boolean
          message: string | null
          name: string | null
          phone: string | null
          replied: boolean
          school_id: string | null
          source: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          name?: string | null
          phone?: string | null
          replied?: boolean
          school_id?: string | null
          source?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          name?: string | null
          phone?: string | null
          replied?: boolean
          school_id?: string | null
          source?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      contributions: {
        Row: {
          category: string | null
          contributor_name: string | null
          description: string | null
          email: string | null
          file_count: number
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string | null
          status: string
          storage_path: string | null
          submitted_at: string
          title: string | null
        }
        Insert: {
          category?: string | null
          contributor_name?: string | null
          description?: string | null
          email?: string | null
          file_count?: number
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string
          storage_path?: string | null
          submitted_at?: string
          title?: string | null
        }
        Update: {
          category?: string | null
          contributor_name?: string | null
          description?: string | null
          email?: string | null
          file_count?: number
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string
          storage_path?: string | null
          submitted_at?: string
          title?: string | null
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          email: string | null
          id: string
          message: string | null
          name: string | null
          page_url: string | null
          rating: number | null
          submitted_at: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          page_url?: string | null
          rating?: number | null
          submitted_at?: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          page_url?: string | null
          rating?: number | null
          submitted_at?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      newsletter_issues: {
        Row: {
          content_url: string | null
          created_at: string
          id: string
          issue_number: string
          published_at: string
          title: string
        }
        Insert: {
          content_url?: string | null
          created_at?: string
          id?: string
          issue_number: string
          published_at: string
          title: string
        }
        Update: {
          content_url?: string | null
          created_at?: string
          id?: string
          issue_number?: string
          published_at?: string
          title?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          bucket: string
          created_at: string
          id: number
          ip: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: number
          ip: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: number
          ip?: string
        }
        Relationships: []
      }
      research_authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          external_url: string | null
          full_name: string
          id: string
          institution: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          external_url?: string | null
          full_name: string
          id?: string
          institution?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          external_url?: string | null
          full_name?: string
          id?: string
          institution?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      research_media: {
        Row: {
          created_at: string
          id: string
          post_id: string
          title: string | null
          type: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          title?: string | null
          type?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          title?: string | null
          type?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "research_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      research_post_authors: {
        Row: {
          author_id: string
          id: string
          order: number | null
          post_id: string
          role: string | null
        }
        Insert: {
          author_id: string
          id?: string
          order?: number | null
          post_id: string
          role?: string | null
        }
        Update: {
          author_id?: string
          id?: string
          order?: number | null
          post_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_post_authors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "research_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_post_authors_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "research_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      research_posts: {
        Row: {
          content: string | null
          created_at: string
          id: string
          published_at: string | null
          slug: string | null
          status: string
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          slug?: string | null
          status?: string
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          slug?: string | null
          status?: string
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      research_subscribers: {
        Row: {
          confirmed: boolean
          created_at: string
          email: string
          id: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      survey_answers: {
        Row: {
          answer_choice: string | null
          answer_text: string | null
          created_at: string
          id: string
          question_id: string | null
          response_id: string
        }
        Insert: {
          answer_choice?: string | null
          answer_text?: string | null
          created_at?: string
          id?: string
          question_id?: string | null
          response_id: string
        }
        Update: {
          answer_choice?: string | null
          answer_text?: string | null
          created_at?: string
          id?: string
          question_id?: string | null
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "survey_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_posts: {
        Row: {
          content: string | null
          created_at: string
          id: string
          language: string | null
          profile: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          language?: string | null
          profile?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          language?: string | null
          profile?: string | null
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          completed: boolean
          contact_email: string | null
          created_at: string
          id: string
          language: string | null
          profile: string | null
          source: string | null
          time_to_complete_seconds: number | null
        }
        Insert: {
          completed?: boolean
          contact_email?: string | null
          created_at?: string
          id?: string
          language?: string | null
          profile?: string | null
          source?: string | null
          time_to_complete_seconds?: number | null
        }
        Update: {
          completed?: boolean
          contact_email?: string | null
          created_at?: string
          id?: string
          language?: string | null
          profile?: string | null
          source?: string | null
          time_to_complete_seconds?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_ip: string
          p_max: number
          p_window: string
        }
        Returns: boolean
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
      attached_files: {
        Row: {
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          message_id: string
          mime_type: string | null
          uploaded_at: string
        }
        Insert: {
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          message_id: string
          mime_type?: string | null
          uploaded_at?: string
        }
        Update: {
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          message_id?: string
          mime_type?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attached_files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_answers: {
        Row: {
          answer_text: string | null
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          question_id: string
          raya_feedback: string | null
          response_time_ms: number | null
        }
        Insert: {
          answer_text?: string | null
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          raya_feedback?: string | null
          response_time_ms?: number | null
        }
        Update: {
          answer_text?: string | null
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          raya_feedback?: string | null
          response_time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "challenge_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "challenge_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_attempts: {
        Row: {
          challenge_id: string
          completed_at: string | null
          id: string
          pauses_used: number
          score: number | null
          status: string
          time_used_seconds: number | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          id?: string
          pauses_used?: number
          score?: number | null
          status?: string
          time_used_seconds?: number | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          id?: string
          pauses_used?: number
          score?: number | null
          status?: string
          time_used_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_attempts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_questions: {
        Row: {
          challenge_id: string
          concept_id: string | null
          content: string | null
          correct_answer: string | null
          id: string
          options: Json | null
          order: number | null
          type: string | null
        }
        Insert: {
          challenge_id: string
          concept_id?: string | null
          content?: string | null
          correct_answer?: string | null
          id?: string
          options?: Json | null
          order?: number | null
          type?: string | null
        }
        Update: {
          challenge_id?: string
          concept_id?: string | null
          content?: string | null
          correct_answer?: string | null
          id?: string
          options?: Json | null
          order?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_questions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          created_by: string | null
          deadline_at: string | null
          description: string | null
          duration_seconds: number | null
          format: string | null
          id: string
          pause_count: number
          pause_duration_seconds: number
          question_count: number | null
          room_id: string | null
          scope: string | null
          status: string
          subject: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          format?: string | null
          id?: string
          pause_count?: number
          pause_duration_seconds?: number
          question_count?: number | null
          room_id?: string | null
          scope?: string | null
          status?: string
          subject?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          format?: string | null
          id?: string
          pause_count?: number
          pause_duration_seconds?: number
          question_count?: number | null
          room_id?: string | null
          scope?: string | null
          status?: string
          subject?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_files: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          message_id: string | null
          mime_type: string | null
          uploader_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          uploader_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_files_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived_at: string | null
          class_enrollment_id: string | null
          context_type: string
          created_at: string
          difficulty: string | null
          id: string
          is_active: boolean
          is_private_room_channel: boolean
          is_training_eligible: boolean
          kernel_triggered: boolean
          memorized_at: string | null
          message_count: number
          room_id: string | null
          school_id: string | null
          session_id: string | null
          subject: string | null
          subject_detected: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          class_enrollment_id?: string | null
          context_type?: string
          created_at?: string
          difficulty?: string | null
          id?: string
          is_active?: boolean
          is_private_room_channel?: boolean
          is_training_eligible?: boolean
          kernel_triggered?: boolean
          memorized_at?: string | null
          message_count?: number
          room_id?: string | null
          school_id?: string | null
          session_id?: string | null
          subject?: string | null
          subject_detected?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          class_enrollment_id?: string | null
          context_type?: string
          created_at?: string
          difficulty?: string | null
          id?: string
          is_active?: boolean
          is_private_room_channel?: boolean
          is_training_eligible?: boolean
          kernel_triggered?: boolean
          memorized_at?: string | null
          message_count?: number
          room_id?: string | null
          school_id?: string | null
          session_id?: string | null
          subject?: string | null
          subject_detected?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "student_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_translations: {
        Row: {
          body: string
          created_at: string
          hits: number
          last_used_at: string
          locale: string
          meta: string | null
          source_hash: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          hits?: number
          last_used_at?: string
          locale: string
          meta?: string | null
          source_hash: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          hits?: number
          last_used_at?: string
          locale?: string
          meta?: string | null
          source_hash?: string
          title?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kernel_profile_snapshots: {
        Row: {
          alerts: Json
          alerts_updated_at: string | null
          anchored_analysis: Json | null
          anchored_updated_at: string | null
          latest_analysis: Json | null
          profile: Json | null
          profile_updated_at: string | null
          user_id: string
        }
        Insert: {
          alerts?: Json
          alerts_updated_at?: string | null
          anchored_analysis?: Json | null
          anchored_updated_at?: string | null
          latest_analysis?: Json | null
          profile?: Json | null
          profile_updated_at?: string | null
          user_id: string
        }
        Update: {
          alerts?: Json
          alerts_updated_at?: string | null
          anchored_analysis?: Json | null
          anchored_updated_at?: string | null
          latest_analysis?: Json | null
          profile?: Json | null
          profile_updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      learning_events: {
        Row: {
          concept_id: string | null
          confidence_signal: number | null
          conversation_id: string | null
          event_type: string
          id: string
          occurred_at: string
          payload: Json | null
          room_id: string | null
          rule_version: string | null
          session_id: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          concept_id?: string | null
          confidence_signal?: number | null
          conversation_id?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          room_id?: string | null
          rule_version?: string | null
          session_id?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          concept_id?: string | null
          confidence_signal?: number | null
          conversation_id?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          room_id?: string | null
          rule_version?: string | null
          session_id?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "student_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          action_type: string | null
          blocage_type: string | null
          client_msg_id: string | null
          concept_id: string | null
          content: string | null
          conversation_id: string
          created_at: string
          emt_level: string | null
          has_media: boolean
          id: string
          is_assisted: boolean
          langue_interaction: string | null
          model_used: string | null
          parent_id: string | null
          partial_credit_score: number | null
          response_time_ms: number | null
          role: string
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          blocage_type?: string | null
          client_msg_id?: string | null
          concept_id?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          emt_level?: string | null
          has_media?: boolean
          id?: string
          is_assisted?: boolean
          langue_interaction?: string | null
          model_used?: string | null
          parent_id?: string | null
          partial_credit_score?: number | null
          response_time_ms?: number | null
          role: string
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          blocage_type?: string | null
          client_msg_id?: string | null
          concept_id?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          emt_level?: string | null
          has_media?: boolean
          id?: string
          is_assisted?: boolean
          langue_interaction?: string | null
          model_used?: string | null
          parent_id?: string | null
          partial_credit_score?: number | null
          response_time_ms?: number | null
          role?: string
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          payload: Json
          sender_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json
          sender_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json
          sender_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      room_files: {
        Row: {
          content: string | null
          created_at: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          message_id: string | null
          mime_type: string | null
          room_id: string
          uploader_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          room_id: string
          uploader_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          room_id?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_files_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          id: string
          is_online: boolean
          joined_at: string
          mode_changes_left: number
          model_changes_left: number
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_online?: boolean
          joined_at?: string
          mode_changes_left?: number
          model_changes_left?: number
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_online?: boolean
          joined_at?: string
          mode_changes_left?: number
          model_changes_left?: number
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          content: string | null
          created_at: string
          has_media: boolean
          id: string
          parent_id: string | null
          role: string
          room_id: string
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          has_media?: boolean
          id?: string
          parent_id?: string | null
          role: string
          room_id: string
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          has_media?: boolean
          id?: string
          parent_id?: string | null
          role?: string
          room_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_reports: {
        Row: {
          created_at: string
          highlights: Json
          id: string
          kernel_version: string | null
          key_learnings: string | null
          recommendations: string | null
          room_id: string
          scope: string
          squad_score: number | null
          summary: string | null
          url: string | null
          visible_to_school: boolean
        }
        Insert: {
          created_at?: string
          highlights?: Json
          id?: string
          kernel_version?: string | null
          key_learnings?: string | null
          recommendations?: string | null
          room_id: string
          scope?: string
          squad_score?: number | null
          summary?: string | null
          url?: string | null
          visible_to_school?: boolean
        }
        Update: {
          created_at?: string
          highlights?: Json
          id?: string
          kernel_version?: string | null
          key_learnings?: string | null
          recommendations?: string | null
          room_id?: string
          scope?: string
          squad_score?: number | null
          summary?: string | null
          url?: string | null
          visible_to_school?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "room_reports_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          ai_mode: string
          ai_turn_started_at: string | null
          ai_turn_status: string
          alert_2m_sent: boolean
          alert_5m_sent: boolean
          alert_end_sent: boolean
          challenge_enabled: boolean
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_members: number
          mission: string | null
          name: string
          online_count: number
          rag_enabled: boolean
          report_generated: boolean
          status: string
          subject: string | null
          timer_ends_at: string | null
          timer_started_at: string | null
          timer_status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          ai_mode?: string
          ai_turn_started_at?: string | null
          ai_turn_status?: string
          alert_2m_sent?: boolean
          alert_5m_sent?: boolean
          alert_end_sent?: boolean
          challenge_enabled?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_members?: number
          mission?: string | null
          name: string
          online_count?: number
          rag_enabled?: boolean
          report_generated?: boolean
          status?: string
          subject?: string | null
          timer_ends_at?: string | null
          timer_started_at?: string | null
          timer_status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          ai_mode?: string
          ai_turn_started_at?: string | null
          ai_turn_status?: string
          alert_2m_sent?: boolean
          alert_5m_sent?: boolean
          alert_end_sent?: boolean
          challenge_enabled?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_members?: number
          mission?: string | null
          name?: string
          online_count?: number
          rag_enabled?: boolean
          report_generated?: boolean
          status?: string
          subject?: string | null
          timer_ends_at?: string | null
          timer_started_at?: string | null
          timer_status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      shares: {
        Row: {
          body: string | null
          brand: string
          created_at: string
          id: string
          kind: string
          revoked_at: string | null
          title: string | null
          token: string
          user_id: string
        }
        Insert: {
          body?: string | null
          brand?: string
          created_at?: string
          id?: string
          kind?: string
          revoked_at?: string | null
          title?: string | null
          token: string
          user_id: string
        }
        Update: {
          body?: string | null
          brand?: string
          created_at?: string
          id?: string
          kind?: string
          revoked_at?: string | null
          title?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      student_memory_sessions: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          insights_generated: Json | null
          subjects_covered: string[] | null
          summary: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          insights_generated?: Json | null
          subjects_covered?: string[] | null
          summary?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          insights_generated?: Json | null
          subjects_covered?: string[] | null
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_memory_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_sessions: {
        Row: {
          conversation_count: number
          created_at: string
          device_type: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          message_count: number
          started_at: string
          subjects_covered: string[] | null
          user_id: string
        }
        Insert: {
          conversation_count?: number
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          message_count?: number
          started_at?: string
          subjects_covered?: string[] | null
          user_id: string
        }
        Update: {
          conversation_count?: number
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          message_count?: number
          started_at?: string
          subjects_covered?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      student_simulations: {
        Row: {
          add_hours: number
          created_at: string
          focus: string | null
          id: string
          result: Json
          user_id: string
        }
        Insert: {
          add_hours: number
          created_at?: string
          focus?: string | null
          id?: string
          result: Json
          user_id?: string
        }
        Update: {
          add_hours?: number
          created_at?: string
          focus?: string | null
          id?: string
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      tool_outputs: {
        Row: {
          concept_ids: string[] | null
          conversation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          kernel_processed: boolean
          output_content: Json
          output_url: string | null
          source_media_id: string | null
          status: string
          tool_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concept_ids?: string[] | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kernel_processed?: boolean
          output_content?: Json
          output_url?: string | null
          source_media_id?: string | null
          status?: string
          tool_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concept_ids?: string[] | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kernel_processed?: boolean
          output_content?: Json
          output_url?: string | null
          source_media_id?: string | null
          status?: string
          tool_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_outputs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      room_has_minor: { Args: { p_room_id: string }; Returns: boolean }
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
      signup_ip_events: {
        Row: {
          created_at: string
          id: number
          ip: string
        }
        Insert: {
          created_at?: string
          id?: never
          ip: string
        }
        Update: {
          created_at?: string
          id?: never
          ip?: string
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
          age_declared_at: string | null
          auth_method: string
          birth_year: number | null
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
          minor_consent_at: string | null
          minor_consent_note: string | null
          minor_consent_source: string | null
          onboarding_completed_at: string | null
          profile_picture_url: string | null
          recovery_code: string | null
          recovery_code_hash: string | null
          recovery_code_issued_at: string | null
          recovery_keyword_hash: string | null
          recovery_keyword_set_at: string | null
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
          age_declared_at?: string | null
          auth_method?: string
          birth_year?: number | null
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
          minor_consent_at?: string | null
          minor_consent_note?: string | null
          minor_consent_source?: string | null
          onboarding_completed_at?: string | null
          profile_picture_url?: string | null
          recovery_code?: string | null
          recovery_code_hash?: string | null
          recovery_code_issued_at?: string | null
          recovery_keyword_hash?: string | null
          recovery_keyword_set_at?: string | null
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
          age_declared_at?: string | null
          auth_method?: string
          birth_year?: number | null
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
          minor_consent_at?: string | null
          minor_consent_note?: string | null
          minor_consent_source?: string | null
          onboarding_completed_at?: string | null
          profile_picture_url?: string | null
          recovery_code?: string | null
          recovery_code_hash?: string | null
          recovery_code_issued_at?: string | null
          recovery_keyword_hash?: string | null
          recovery_keyword_set_at?: string | null
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
      challenge_leaderboard: {
        Args: { p_challenge_id: string }
        Returns: {
          display_name: string
          score: number
          status: string
          user_id: string
          username: string
        }[]
      }
      check_signup_ip: {
        Args: { p_ip: string; p_max: number; p_window: string }
        Returns: boolean
      }
      deactivate_dormant_anons: {
        Args: { p_days?: number; p_limit?: number }
        Returns: number
      }
      delete_expired_anons: {
        Args: { p_days?: number; p_limit?: number }
        Returns: number
      }
      is_anonymous: { Args: never; Returns: boolean }
      is_god: { Args: never; Returns: boolean }
      is_room_member: { Args: { p_room_id: string }; Returns: boolean }
      is_school_admin: { Args: { p_school_id: string }; Returns: boolean }
      list_expired_anons: {
        Args: { p_days?: number; p_limit?: number }
        Returns: string[]
      }
      prune_signup_ip_events: { Args: { p_days?: number }; Returns: number }
      room_roster: {
        Args: { p_room_id: string }
        Returns: {
          display_name: string
          profile_picture_url: string
          role: string
          user_id: string
          username: string
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
  rag: {
    Tables: {
      conversation_embeddings: {
        Row: {
          concept_id: string | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          user_id: string
        }
        Insert: {
          concept_id?: string | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          user_id: string
        }
        Update: {
          concept_id?: string | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      rag_chunks: {
        Row: {
          assignment_id: string | null
          class_id: string | null
          concept_id: string | null
          content: string | null
          created_at: string
          embedding: string | null
          id: string
          source_id: string | null
          source_type: string
          user_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          class_id?: string | null
          concept_id?: string | null
          content?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          source_id?: string | null
          source_type: string
          user_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          class_id?: string | null
          concept_id?: string | null
          content?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          source_id?: string | null
          source_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rag_queries: {
        Row: {
          chunks_retrieved: number | null
          conversation_id: string | null
          created_at: string
          id: string
          query_text: string | null
          room_id: string | null
          top_source_type: string | null
          user_id: string
        }
        Insert: {
          chunks_retrieved?: number | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          query_text?: string | null
          room_id?: string | null
          top_source_type?: string | null
          user_id: string
        }
        Update: {
          chunks_retrieved?: number | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          query_text?: string | null
          room_id?: string | null
          top_source_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      school_documents: {
        Row: {
          assignment_id: string | null
          created_at: string
          embedding_status: string
          id: string
          title: string | null
          type: string | null
          url: string | null
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          embedding_status?: string
          id?: string
          title?: string | null
          type?: string | null
          url?: string | null
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          embedding_status?: string
          id?: string
          title?: string | null
          type?: string | null
          url?: string | null
        }
        Relationships: []
      }
      user_media: {
        Row: {
          conversation_id: string | null
          created_at: string
          embedding_status: string
          extracted_text: string | null
          id: string
          room_id: string | null
          size_bytes: number | null
          title: string | null
          type: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          embedding_status?: string
          extracted_text?: string | null
          id?: string
          room_id?: string | null
          size_bytes?: number | null
          title?: string | null
          type?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          embedding_status?: string
          extracted_text?: string | null
          id?: string
          room_id?: string | null
          size_bytes?: number | null
          title?: string | null
          type?: string | null
          url?: string | null
          user_id?: string
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
  schools: {
    Tables: {
      ab_experiments: {
        Row: {
          created_at: string
          description: string | null
          ended_at: string | null
          id: string
          name: string
          results: Json | null
          started_at: string | null
          status: string
          target: string | null
          variants: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          name: string
          results?: Json | null
          started_at?: string | null
          status?: string
          target?: string | null
          variants?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          name?: string
          results?: Json | null
          started_at?: string | null
          status?: string
          target?: string | null
          variants?: Json | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string | null
          last_used_at: string | null
          name: string | null
          school_id: string
          scopes: string[] | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string | null
          last_used_at?: string | null
          name?: string | null
          school_id: string
          scopes?: string[] | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string | null
          last_used_at?: string | null
          name?: string | null
          school_id?: string
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          id: string
          prof_id: string
          subject_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          prof_id: string
          subject_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prof_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "school_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_prof_id_fkey"
            columns: ["prof_id"]
            isOneToOne: false
            referencedRelation: "school_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_access_codes: {
        Row: {
          class_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          retired_at: string | null
          school_year_id: string | null
        }
        Insert: {
          class_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          retired_at?: string | null
          school_year_id?: string | null
        }
        Update: {
          class_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          retired_at?: string | null
          school_year_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_access_codes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_access_codes_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      class_insights: {
        Row: {
          avg_cognitive_depth: number | null
          avg_correct_ratio: number | null
          avg_mastery: number | null
          avg_resilience: number | null
          class_id: string | null
          concepts_covered: string[] | null
          confidence: number | null
          created_at: string
          curriculum_refs: string[] | null
          deepest_gap_level: number | null
          exchange_count: number
          id: string
          kernel_version: string | null
          mastery_trend: number | null
          off_curriculum_ratio: number | null
          peak_hour: number | null
          period: string | null
          period_end: string | null
          period_start: string | null
          root_causes: Json | null
          school_id: string
          school_year_id: string | null
          session_count: number
          student_count: number
          subject_id: string | null
          top_gaps: Json | null
          top_recommendation: string | null
        }
        Insert: {
          avg_cognitive_depth?: number | null
          avg_correct_ratio?: number | null
          avg_mastery?: number | null
          avg_resilience?: number | null
          class_id?: string | null
          concepts_covered?: string[] | null
          confidence?: number | null
          created_at?: string
          curriculum_refs?: string[] | null
          deepest_gap_level?: number | null
          exchange_count?: number
          id?: string
          kernel_version?: string | null
          mastery_trend?: number | null
          off_curriculum_ratio?: number | null
          peak_hour?: number | null
          period?: string | null
          period_end?: string | null
          period_start?: string | null
          root_causes?: Json | null
          school_id: string
          school_year_id?: string | null
          session_count?: number
          student_count?: number
          subject_id?: string | null
          top_gaps?: Json | null
          top_recommendation?: string | null
        }
        Update: {
          avg_cognitive_depth?: number | null
          avg_correct_ratio?: number | null
          avg_mastery?: number | null
          avg_resilience?: number | null
          class_id?: string | null
          concepts_covered?: string[] | null
          confidence?: number | null
          created_at?: string
          curriculum_refs?: string[] | null
          deepest_gap_level?: number | null
          exchange_count?: number
          id?: string
          kernel_version?: string | null
          mastery_trend?: number | null
          off_curriculum_ratio?: number | null
          peak_hour?: number | null
          period?: string | null
          period_end?: string | null
          period_start?: string | null
          root_causes?: Json | null
          school_id?: string
          school_year_id?: string | null
          session_count?: number
          student_count?: number
          subject_id?: string | null
          top_gaps?: Json | null
          top_recommendation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_insights_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_insights_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_insights_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_insights_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_instructions: {
        Row: {
          class_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          school_id: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          school_id: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          school_id?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_instructions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_instructions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_instructions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          expected_size: number | null
          id: string
          level: string | null
          max_overflow: number
          name: string
          school_id: string
          school_year_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_size?: number | null
          id?: string
          level?: string | null
          max_overflow?: number
          name: string
          school_id: string
          school_year_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_size?: number | null
          id?: string
          level?: string | null
          max_overflow?: number
          name?: string
          school_id?: string
          school_year_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_adjustments: {
        Row: {
          adjustment_type: string | null
          amount_charged: number
          class_enrollment_id: string | null
          created_at: string
          difference: number | null
          id: string
          new_size: number | null
          notes: string | null
          old_size: number | null
          payment_reference: string | null
          payment_status: string | null
          quarter: number | null
          requested_by: string | null
          school_id: string
          school_year_id: string | null
          updated_at: string
        }
        Insert: {
          adjustment_type?: string | null
          amount_charged?: number
          class_enrollment_id?: string | null
          created_at?: string
          difference?: number | null
          id?: string
          new_size?: number | null
          notes?: string | null
          old_size?: number | null
          payment_reference?: string | null
          payment_status?: string | null
          quarter?: number | null
          requested_by?: string | null
          school_id: string
          school_year_id?: string | null
          updated_at?: string
        }
        Update: {
          adjustment_type?: string | null
          amount_charged?: number
          class_enrollment_id?: string | null
          created_at?: string
          difference?: number | null
          id?: string
          new_size?: number | null
          notes?: string | null
          old_size?: number | null
          payment_reference?: string | null
          payment_status?: string | null
          quarter?: number | null
          requested_by?: string | null
          school_id?: string
          school_year_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_adjustments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_adjustments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_class_mappings: {
        Row: {
          class_id: string | null
          created_at: string
          external_class_id: string
          external_class_name: string | null
          id: string
          last_synced_at: string | null
          lms_connection_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          external_class_id: string
          external_class_name?: string | null
          id?: string
          last_synced_at?: string | null
          lms_connection_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          external_class_id?: string
          external_class_name?: string | null
          id?: string
          last_synced_at?: string | null
          lms_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_class_mappings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_class_mappings_lms_connection_id_fkey"
            columns: ["lms_connection_id"]
            isOneToOne: false
            referencedRelation: "lms_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_connections: {
        Row: {
          access_token: string | null
          created_at: string
          external_org_id: string | null
          external_org_name: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          provider: string
          refresh_token: string | null
          school_id: string
          sync_error: string | null
          sync_status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          external_org_id?: string | null
          external_org_name?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          provider: string
          refresh_token?: string | null
          school_id: string
          sync_error?: string | null
          sync_status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          external_org_id?: string | null
          external_org_name?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          school_id?: string
          sync_error?: string | null
          sync_status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_connections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          audience: string
          channel: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          metadata: Json
          months: number
          paid_at: string | null
          plan_id: string
          provider: string
          provider_ref: string | null
          school_id: string | null
          seat_limit: number | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          audience: string
          channel: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          metadata?: Json
          months?: number
          paid_at?: string | null
          plan_id: string
          provider: string
          provider_ref?: string | null
          school_id?: string | null
          seat_limit?: number | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          audience?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          metadata?: Json
          months?: number
          paid_at?: string | null
          plan_id?: string
          provider?: string
          provider_ref?: string | null
          school_id?: string | null
          seat_limit?: number | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_region_prices: {
        Row: {
          billing_period: string | null
          bundle_seats: number | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          plan_id: string
          price: number
          price_unit: string
          region_code: string
          updated_at: string
        }
        Insert: {
          billing_period?: string | null
          bundle_seats?: number | null
          created_at?: string
          currency: string
          id?: string
          is_active?: boolean
          plan_id: string
          price: number
          price_unit?: string
          region_code: string
          updated_at?: string
        }
        Update: {
          billing_period?: string | null
          bundle_seats?: number | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          plan_id?: string
          price?: number
          price_unit?: string
          region_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_region_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      prof_subject_codes: {
        Row: {
          assignment_id: string
          code: string
          created_at: string
          id: string
          last_used_at: string | null
        }
        Insert: {
          assignment_id: string
          code: string
          created_at?: string
          id?: string
          last_used_at?: string | null
        }
        Update: {
          assignment_id?: string
          code?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prof_subject_codes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string | null
          id: string
          keys: Json | null
          school_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint?: string | null
          id?: string
          keys?: Json | null
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string | null
          id?: string
          keys?: Json | null
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          created_by: string | null
          format: string | null
          id: string
          parameters: Json | null
          school_id: string
          scope: string | null
          status: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          format?: string | null
          id?: string
          parameters?: Json | null
          school_id: string
          scope?: string | null
          status?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          format?: string | null
          id?: string
          parameters?: Json | null
          school_id?: string
          scope?: string | null
          status?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "school_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_assignments: {
        Row: {
          assigned_by: string | null
          challenge_id: string
          class_id: string
          created_at: string
          due_at: string | null
          id: string
          is_active: boolean
          kind: string
          resource_id: string | null
          school_id: string
          title: string
        }
        Insert: {
          assigned_by?: string | null
          challenge_id: string
          class_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          resource_id?: string | null
          school_id: string
          title: string
        }
        Update: {
          assigned_by?: string | null
          challenge_id?: string
          class_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          resource_id?: string | null
          school_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "school_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_assignments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "teacher_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_admin_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          metadata: Json
          school_id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          school_id: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          school_id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_admin_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "school_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_admin_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_admins: {
        Row: {
          confirmed_school_year_id: string | null
          created_at: string
          id: string
          role: string
          school_id: string
          user_id: string
        }
        Insert: {
          confirmed_school_year_id?: string | null
          created_at?: string
          id?: string
          role?: string
          school_id: string
          user_id: string
        }
        Update: {
          confirmed_school_year_id?: string | null
          created_at?: string
          id?: string
          role?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_admins_confirmed_school_year_id_fkey"
            columns: ["confirmed_school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_admins_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_curriculum_layers: {
        Row: {
          concept_ids: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          layer_name: string
          layer_type: string
          level: string
          payload: Json | null
          school_id: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          concept_ids?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          layer_name: string
          layer_type?: string
          level: string
          payload?: Json | null
          school_id: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          concept_ids?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          layer_name?: string
          layer_type?: string
          level?: string
          payload?: Json | null
          school_id?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      school_directives: {
        Row: {
          audience: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          school_id: string
          updated_at: string
        }
        Insert: {
          audience?: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          school_id: string
          updated_at?: string
        }
        Update: {
          audience?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_directives_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_join_requests: {
        Row: {
          code_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          school_id: string
          status: string
          user_id: string
        }
        Insert: {
          code_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          school_id: string
          status?: string
          user_id: string
        }
        Update: {
          code_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          school_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_join_requests_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "staff_invite_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_join_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_years: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          label: string
          school_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          label: string
          school_id: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          label?: string
          school_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          admin_key: string | null
          city: string | null
          country_code: string | null
          created_at: string
          current_school_year_id: string | null
          data_privacy_mode: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          pilot_until: string | null
          school_type: string | null
          subscription_expires_at: string | null
          subscription_tier: string
          updated_at: string
        }
        Insert: {
          admin_key?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          current_school_year_id?: string | null
          data_privacy_mode?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          pilot_until?: string | null
          school_type?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Update: {
          admin_key?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          current_school_year_id?: string | null
          data_privacy_mode?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          pilot_until?: string | null
          school_type?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_current_year_fk"
            columns: ["current_school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          parameters: Json | null
          result: Json | null
          school_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          parameters?: Json | null
          result?: Json | null
          school_id: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          parameters?: Json | null
          result?: Json | null
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "school_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invite_codes: {
        Row: {
          auto_approve: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          school_id: string
          single_use: boolean
        }
        Insert: {
          auto_approve?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          school_id: string
          single_use?: boolean
        }
        Update: {
          auto_approve?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          school_id?: string
          single_use?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "staff_invite_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_preferences: {
        Row: {
          admin_id: string
          prefs: Json
          updated_at: string
        }
        Insert: {
          admin_id: string
          prefs?: Json
          updated_at?: string
        }
        Update: {
          admin_id?: string
          prefs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_preferences_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: true
            referencedRelation: "school_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      student_followups: {
        Row: {
          author_admin_id: string | null
          class_id: string
          content: string
          created_at: string
          id: string
          school_id: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          author_admin_id?: string | null
          class_id: string
          content: string
          created_at?: string
          id?: string
          school_id: string
          student_user_id: string
          updated_at?: string
        }
        Update: {
          author_admin_id?: string | null
          class_id?: string
          content?: string
          created_at?: string
          id?: string
          school_id?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_followups_author_admin_id_fkey"
            columns: ["author_admin_id"]
            isOneToOne: false
            referencedRelation: "school_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_followups_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_followups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_identities: {
        Row: {
          class_id: string
          created_at: string
          first_name: string
          last_name: string
          school_id: string
          school_year_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          first_name: string
          last_name: string
          school_id: string
          school_year_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          first_name?: string
          last_name?: string
          school_id?: string
          school_year_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_identities_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_identities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_identities_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_global: boolean
          name: string
          school_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_global?: boolean
          name: string
          school_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_global?: boolean
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_period: string | null
          category: string | null
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          message_limit: number | null
          name: string
          price: number | null
          price_unit: string
          seat_limit: number | null
          storage_gb: number | null
          tier: string | null
        }
        Insert: {
          billing_period?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          features?: Json
          id: string
          is_active?: boolean
          message_limit?: number | null
          name: string
          price?: number | null
          price_unit?: string
          seat_limit?: number | null
          storage_gb?: number | null
          tier?: string | null
        }
        Update: {
          billing_period?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          message_limit?: number | null
          name?: string
          price?: number | null
          price_unit?: string
          seat_limit?: number | null
          storage_gb?: number | null
          tier?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          auto_renew: boolean
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          payment_method: string | null
          payment_reference: string | null
          plan_id: string | null
          school_id: string | null
          seat_limit: number | null
          start_date: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          auto_renew?: boolean
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          plan_id?: string | null
          school_id?: string | null
          seat_limit?: number | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          auto_renew?: boolean
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          plan_id?: string | null
          school_id?: string | null
          seat_limit?: number | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_resources: {
        Row: {
          class_id: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          parameters: Json
          questions: Json
          school_id: string
          status: string
          subject_id: string | null
          title: string
        }
        Insert: {
          class_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          parameters?: Json
          questions?: Json
          school_id: string
          status?: string
          subject_id?: string | null
          title: string
        }
        Update: {
          class_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          parameters?: Json
          questions?: Json
          school_id?: string
          status?: string
          subject_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_resources_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "school_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_resources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_resources_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_metrics: {
        Row: {
          id: string
          metric: string | null
          period: string | null
          school_id: string
          updated_at: string
          value: number
        }
        Insert: {
          id?: string
          metric?: string | null
          period?: string | null
          school_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          id?: string
          metric?: string | null
          period?: string | null
          school_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      regenerate_class_code: {
        Args: { p_class_id: string; p_school_year_id: string }
        Returns: {
          out_code: string
          out_id: string
          out_is_active: boolean
        }[]
      }
      set_active_school_year: {
        Args: {
          p_end: string
          p_label: string
          p_school_id: string
          p_start: string
        }
        Returns: {
          out_id: string
          out_label: string
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
  content: {
    Enums: {},
  },
  learning: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  rag: {
    Enums: {},
  },
  schools: {
    Enums: {},
  },
} as const
