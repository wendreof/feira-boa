export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          created_at: string;
          timezone: string;
          notifications_paused: boolean;
          preferences: Json;
          avatar_path: string | null;
          display_name: string | null;
        };
        Insert: {
          user_id: string;
          created_at?: string;
          timezone?: string;
          notifications_paused?: boolean;
          preferences?: Json;
          avatar_path?: string | null;
          display_name?: string | null;
        };
        Update: {
          user_id?: string;
          created_at?: string;
          timezone?: string;
          notifications_paused?: boolean;
          preferences?: Json;
          avatar_path?: string | null;
          display_name?: string | null;
        };
        Relationships: [];
      };
      alert_rules: {
        Row: {
          id: string;
          user_id: string;
          store: string | null;
          product: string | null;
          product_type: string | null;
          target_price: number;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          store?: string | null;
          product?: string | null;
          product_type?: string | null;
          target_price: number;
          enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          store?: string | null;
          product?: string | null;
          product_type?: string | null;
          target_price?: number;
          enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth_key?: string;
          created_at?: string;
          last_used_at?: string | null;
        };
        Relationships: [];
      };
      notification_log: {
        Row: {
          id: number;
          user_id: string;
          offer_id: string;
          sent_at: string;
          result: "sent" | "failed";
          error_code: string | null;
          title: string | null;
          body: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          offer_id: string;
          sent_at?: string;
          result: "sent" | "failed";
          error_code?: string | null;
          title?: string | null;
          body?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          offer_id?: string;
          sent_at?: string;
          result?: "sent" | "failed";
          error_code?: string | null;
          title?: string | null;
          body?: string | null;
        };
        Relationships: [];
      };
      suggestions: {
        Row: {
          id: string;
          category: "idea" | "bug" | "content" | "other";
          message: string;
          status: "new" | "reviewed" | "closed";
          created_at: string;
          user_id: string | null;
          honeypot: string;
        };
        Insert: {
          category: "idea" | "bug" | "content" | "other";
          message: string;
          user_id: string;
          honeypot?: string;
        };
        Update: never;
        Relationships: [];
      };
      admin_users: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: {
          created_at?: string;
        };
        Relationships: [];
      };
      offer_reactions: {
        Row: {
          user_id: string;
          offer_id: string;
          reaction: "like" | "dislike";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          offer_id: string;
          reaction: "like" | "dislike";
        };
        Update: {
          reaction?: "like" | "dislike";
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_offer_reaction_counts: {
        Args: Record<string, never>;
        Returns: { offer_id: string; likes: number; dislikes: number }[];
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_admin_account_stats: {
        Args: Record<string, never>;
        Returns: {
          total_accounts: number;
          google_accounts: number;
          email_accounts: number;
          accounts_with_alerts: number;
          accounts_with_push: number;
          new_accounts_7d: number;
          new_accounts_30d: number;
        }[];
      };
      get_admin_alert_stats: {
        Args: Record<string, never>;
        Returns: {
          window_days: number;
          sent: number;
          failed: number;
          users_with_alerts: number;
          rules_total: number;
          rules_enabled: number;
          subscriptions_total: number;
          last_sent_at: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
