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
      billing_customers: {
        Row: {
          billing_email: string | null
          created_at: string
          external_customer_id: string
          provider: string
          workspace_id: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          external_customer_id: string
          provider?: string
          workspace_id: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          external_customer_id?: string
          provider?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          message_references: Json | null
          role: Database["public"]["Enums"]["chat_role"]
          session_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          message_references?: Json | null
          role: Database["public"]["Enums"]["chat_role"]
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_references?: Json | null
          role?: Database["public"]["Enums"]["chat_role"]
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          document_id: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_accounts: {
        Row: {
          available: number
          consumed: number
          expired: number
          reserved: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          available?: number
          consumed?: number
          expired?: number
          reserved?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          available?: number
          consumed?: number
          expired?: number
          reserved?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_buckets: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          original_amount: number
          priority: number
          remaining_amount: number
          source_type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          original_amount: number
          priority?: number
          remaining_amount: number
          source_type: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          original_amount?: number
          priority?: number
          remaining_amount?: number
          source_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_buckets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          amount: number
          bucket_id: string | null
          created_at: string
          direction: number
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          idempotency_key: string | null
          job_id: string | null
          reservation_id: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          bucket_id?: string | null
          created_at?: string
          direction: number
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          reservation_id?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          bucket_id?: string | null
          created_at?: string
          direction?: number
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          reservation_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "credit_buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "credit_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          created_at: string
          credits: number
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price_usd: number
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string
          credits: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_usd: number
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_usd?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      credit_reservations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          job_id: string | null
          requested_amount: number
          reserved_amount: number
          settled_amount: number
          status: Database["public"]["Enums"]["reservation_status"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          job_id?: string | null
          requested_amount: number
          reserved_amount: number
          settled_amount?: number
          status?: Database["public"]["Enums"]["reservation_status"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          job_id?: string | null
          requested_amount?: number
          reserved_amount?: number
          settled_amount?: number
          status?: Database["public"]["Enums"]["reservation_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_reservations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_reservations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      document_analysis: {
        Row: {
          analysis_type: Database["public"]["Enums"]["analysis_task_type"]
          created_at: string | null
          document_id: string | null
          id: string
          model: string | null
          provider: string | null
          result: Json
          version: number | null
        }
        Insert: {
          analysis_type: Database["public"]["Enums"]["analysis_task_type"]
          created_at?: string | null
          document_id?: string | null
          id?: string
          model?: string | null
          provider?: string | null
          result: Json
          version?: number | null
        }
        Update: {
          analysis_type?: Database["public"]["Enums"]["analysis_task_type"]
          created_at?: string | null
          document_id?: string | null
          id?: string
          model?: string | null
          provider?: string | null
          result?: Json
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_analysis_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_pages: {
        Row: {
          confidence: number | null
          created_at: string | null
          document_id: string | null
          embedding_status: string | null
          id: string
          layout_json: Json | null
          ocr_provider: string | null
          page_number: number
          raw_text: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          document_id?: string | null
          embedding_status?: string | null
          id?: string
          layout_json?: Json | null
          ocr_provider?: string | null
          page_number: number
          raw_text?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          document_id?: string | null
          embedding_status?: string | null
          id?: string
          layout_json?: Json | null
          ocr_provider?: string | null
          page_number?: number
          raw_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_hash: string | null
          file_path: string
          id: string
          mime_type: string | null
          name: string
          ocr_status: string | null
          page_count: number | null
          size_bytes: number
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          file_hash?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          name: string
          ocr_status?: string | null
          page_count?: number | null
          size_bytes: number
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          file_hash?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          name?: string
          ocr_status?: string | null
          page_count?: number | null
          size_bytes?: number
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          document_id: string
          front: string
          id: string
          page_number: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          back: string
          created_at?: string
          document_id: string
          front: string
          id?: string
          page_number?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          back?: string
          created_at?: string
          document_id?: string
          front?: string
          id?: string
          page_number?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      glossary_terms: {
        Row: {
          created_at: string
          definition: string
          document_id: string
          id: string
          page_number: number | null
          term: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          definition: string
          document_id: string
          id?: string
          page_number?: number | null
          term: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          definition?: string
          document_id?: string
          id?: string
          page_number?: number | null
          term?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "glossary_terms_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glossary_terms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      highlight_bboxes: {
        Row: {
          cached_at: string | null
          height: number | null
          highlight_id: string | null
          id: string
          page_number: number
          width: number | null
          x: number | null
          y: number | null
        }
        Insert: {
          cached_at?: string | null
          height?: number | null
          highlight_id?: string | null
          id?: string
          page_number: number
          width?: number | null
          x?: number | null
          y?: number | null
        }
        Update: {
          cached_at?: string | null
          height?: number | null
          highlight_id?: string | null
          id?: string
          page_number?: number
          width?: number | null
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "highlight_bboxes_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "highlights"
            referencedColumns: ["id"]
          },
        ]
      }
      highlight_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlight_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      highlights: {
        Row: {
          category_id: string | null
          color: string
          created_at: string
          document_id: string
          id: string
          note: string | null
          page_index: number
          rects: Json
          text: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category_id?: string | null
          color?: string
          created_at?: string
          document_id: string
          id?: string
          note?: string | null
          page_index: number
          rects?: Json
          text?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category_id?: string | null
          color?: string
          created_at?: string
          document_id?: string
          id?: string
          note?: string | null
          page_index?: number
          rects?: Json
          text?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlights_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "highlight_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "highlights_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "highlights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      mind_map_nodes: {
        Row: {
          created_at: string
          document_id: string
          id: string
          label: string
          parent_id: string | null
          position_x: number
          position_y: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          label: string
          parent_id?: string | null
          position_x?: number
          position_y?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          label?: string
          parent_id?: string | null
          position_x?: number
          position_y?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mind_map_nodes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mind_map_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "mind_map_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mind_map_nodes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          event_type: string
          external_event_id: string
          id: string
          processed_at: string
          provider: string
          status: string
        }
        Insert: {
          event_type: string
          external_event_id: string
          id?: string
          processed_at?: string
          provider?: string
          status?: string
        }
        Update: {
          event_type?: string
          external_event_id?: string
          id?: string
          processed_at?: string
          provider?: string
          status?: string
        }
        Relationships: []
      }
      plan_prices: {
        Row: {
          amount: number
          billing_interval: string
          created_at: string
          currency: string
          external_price_id: string | null
          id: string
          plan_id: string
        }
        Insert: {
          amount: number
          billing_interval: string
          created_at?: string
          currency?: string
          external_price_id?: string | null
          id?: string
          plan_id: string
        }
        Update: {
          amount?: number
          billing_interval?: string
          created_at?: string
          currency?: string
          external_price_id?: string | null
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_public: boolean | null
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_public?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_public?: boolean | null
        }
        Relationships: []
      }
      processing_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          job_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          job_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          document_id: string
          error_message: string | null
          id: string
          processing_time: number | null
          progress: number
          provider_metadata: Json | null
          retry_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          document_id: string
          error_message?: string | null
          id?: string
          processing_time?: number | null
          progress?: number
          provider_metadata?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          document_id?: string
          error_message?: string | null
          id?: string
          processing_time?: number | null
          progress?: number
          provider_metadata?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_logs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          log_level: string
          message: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          log_level: string
          message: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          log_level?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_tasks: {
        Row: {
          created_at: string | null
          depends_on: Database["public"]["Enums"]["analysis_task_type"][] | null
          document_id: string | null
          error: string | null
          finished_at: string | null
          id: string
          metadata: Json | null
          model: string | null
          prompt_version: string | null
          provider: string | null
          provider_version: string | null
          schema_version: string | null
          started_at: string | null
          status: string | null
          task: Database["public"]["Enums"]["analysis_task_type"]
          version: number | null
        }
        Insert: {
          created_at?: string | null
          depends_on?:
            | Database["public"]["Enums"]["analysis_task_type"][]
            | null
          document_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt_version?: string | null
          provider?: string | null
          provider_version?: string | null
          schema_version?: string | null
          started_at?: string | null
          status?: string | null
          task: Database["public"]["Enums"]["analysis_task_type"]
          version?: number | null
        }
        Update: {
          created_at?: string | null
          depends_on?:
            | Database["public"]["Enums"]["analysis_task_type"][]
            | null
          document_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt_version?: string | null
          provider?: string | null
          provider_version?: string | null
          schema_version?: string | null
          started_at?: string | null
          status?: string | null
          task?: Database["public"]["Enums"]["analysis_task_type"]
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_tasks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_models: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          max_input_tokens: number | null
          max_output_tokens: number | null
          name: string
          provider_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_input_tokens?: number | null
          max_output_tokens?: number | null
          name: string
          provider_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_input_tokens?: number | null
          max_output_tokens?: number | null
          name?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_pricing: {
        Row: {
          billing_interval_start: string
          created_at: string
          credit_conversion_rate: number
          id: string
          input_price_per_1k: number
          is_active: boolean | null
          model_id: string
          output_price_per_1k: number
        }
        Insert: {
          billing_interval_start?: string
          created_at?: string
          credit_conversion_rate?: number
          id?: string
          input_price_per_1k: number
          is_active?: boolean | null
          model_id: string
          output_price_per_1k: number
        }
        Update: {
          billing_interval_start?: string
          created_at?: string
          credit_conversion_rate?: number
          id?: string
          input_price_per_1k?: number
          is_active?: boolean | null
          model_id?: string
          output_price_per_1k?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_pricing_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "provider_models"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_usd: number
          completed_at: string | null
          created_at: string
          credits_granted: number
          id: string
          package_id: string | null
          status: string
          stripe_session_id: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          amount_usd: number
          completed_at?: string | null
          created_at?: string
          credits_granted: number
          id?: string
          package_id?: string | null
          status?: string
          stripe_session_id?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          amount_usd?: number
          completed_at?: string | null
          created_at?: string
          credits_granted?: number
          id?: string
          package_id?: string | null
          status?: string
          stripe_session_id?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_counters: {
        Row: {
          count: number
          created_at: string
          id: string
          metric: string
          scope_id: string
          scope_type: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          metric: string
          scope_id: string
          scope_type: string
          window_start: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          metric?: string
          scope_id?: string
          scope_type?: string
          window_start?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          severity: string
          signal: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          severity?: string
          signal?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          severity?: string
          signal?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_subscription_id: string
          id: string
          plan_id: string | null
          provider: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_subscription_id: string
          id?: string
          plan_id?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_subscription_id?: string
          id?: string
          plan_id?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          created_at: string
          date_str: string
          description: string
          document_id: string
          id: string
          page_number: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          date_str: string
          description: string
          document_id: string
          id?: string
          page_number?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          date_str?: string
          description?: string
          document_id?: string
          id?: string
          page_number?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_jobs: {
        Row: {
          action_type: string
          completed_at: string | null
          document_id: string | null
          error_details: string | null
          id: string
          input_tokens: number | null
          model_id: string | null
          output_tokens: number | null
          started_at: string
          status: string
          total_cost_credits: number | null
          workspace_id: string
        }
        Insert: {
          action_type: string
          completed_at?: string | null
          document_id?: string | null
          error_details?: string | null
          id?: string
          input_tokens?: number | null
          model_id?: string | null
          output_tokens?: number | null
          started_at?: string
          status?: string
          total_cost_credits?: number | null
          workspace_id: string
        }
        Update: {
          action_type?: string
          completed_at?: string | null
          document_id?: string | null
          error_details?: string | null
          id?: string
          input_tokens?: number | null
          model_id?: string | null
          output_tokens?: number | null
          started_at?: string
          status?: string
          total_cost_credits?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_jobs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "provider_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          dashboard_sort_by: string
          dashboard_sort_order: string
          dashboard_view_mode: string
          id: string
          sidebar_collapsed: boolean
          sort_by: string
          sort_order: string
          theme: string
          updated_at: string
          view_mode: string
        }
        Insert: {
          created_at?: string
          dashboard_sort_by?: string
          dashboard_sort_order?: string
          dashboard_view_mode?: string
          id: string
          sidebar_collapsed?: boolean
          sort_by?: string
          sort_order?: string
          theme?: string
          updated_at?: string
          view_mode?: string
        }
        Update: {
          created_at?: string
          dashboard_sort_by?: string
          dashboard_sort_order?: string
          dashboard_view_mode?: string
          id?: string
          sidebar_collapsed?: boolean
          sort_by?: string
          sort_order?: string
          theme?: string
          updated_at?: string
          view_mode?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_credits: {
        Args: { p_amount: number; p_description: string; p_user_id: string }
        Returns: boolean
      }
      create_workspace: { Args: { workspace_name: string }; Returns: string }
      get_user_workspace_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      analysis_task_type:
        | "ocr"
        | "layout"
        | "chunking"
        | "embeddings"
        | "highlights"
        | "summary"
        | "glossary"
        | "timeline"
        | "flashcards"
        | "mindmap"
        | "podcast"
        | "presentation"
      chat_role: "user" | "assistant" | "system"
      document_status: "uploading" | "processing" | "ready" | "error"
      job_status:
        | "queued"
        | "inspecting"
        | "extracting"
        | "ocr"
        | "layout"
        | "completed"
        | "failed"
        | "retrying"
        | "cancelled"
        | "paused"
        | "processing"
      ledger_entry_type:
        | "grant_plan"
        | "grant_purchase"
        | "grant_promotion"
        | "reserve"
        | "release"
        | "consume"
        | "refund"
        | "expire"
        | "chargeback_hold"
        | "chargeback_reversal"
        | "manual_adjustment"
      plan_type: "free" | "pro" | "team" | "enterprise"
      reservation_status:
        | "pending"
        | "confirmed"
        | "partially_settled"
        | "released"
        | "expired"
        | "cancelled"
        | "failed"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "incomplete"
        | "incomplete_expired"
        | "paused"
      transaction_type: "grant" | "purchase" | "usage"
      workspace_role: "owner" | "member" | "viewer"
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
      analysis_task_type: [
        "ocr",
        "layout",
        "chunking",
        "embeddings",
        "highlights",
        "summary",
        "glossary",
        "timeline",
        "flashcards",
        "mindmap",
        "podcast",
        "presentation",
      ],
      chat_role: ["user", "assistant", "system"],
      document_status: ["uploading", "processing", "ready", "error"],
      job_status: [
        "queued",
        "inspecting",
        "extracting",
        "ocr",
        "layout",
        "completed",
        "failed",
        "retrying",
        "cancelled",
        "paused",
        "processing",
      ],
      ledger_entry_type: [
        "grant_plan",
        "grant_purchase",
        "grant_promotion",
        "reserve",
        "release",
        "consume",
        "refund",
        "expire",
        "chargeback_hold",
        "chargeback_reversal",
        "manual_adjustment",
      ],
      plan_type: ["free", "pro", "team", "enterprise"],
      reservation_status: [
        "pending",
        "confirmed",
        "partially_settled",
        "released",
        "expired",
        "cancelled",
        "failed",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
        "paused",
      ],
      transaction_type: ["grant", "purchase", "usage"],
      workspace_role: ["owner", "member", "viewer"],
    },
  },
} as const
