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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          code: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      crawl_stops: {
        Row: {
          crawl_id: string
          position: number
          restaurant_id: string
          tip: string | null
        }
        Insert: {
          crawl_id: string
          position?: number
          restaurant_id: string
          tip?: string | null
        }
        Update: {
          crawl_id?: string
          position?: number
          restaurant_id?: string
          tip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_stops_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "crawls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_stops_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      crawls: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          emoji: string
          id: string
          is_active: boolean
          reward: string | null
          slug: string
          title: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          is_active?: boolean
          reward?: string | null
          slug: string
          title: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          is_active?: boolean
          reward?: string | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
      decide_members: {
        Row: {
          display_name: string
          joined_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          display_name?: string
          joined_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          display_name?: string
          joined_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decide_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "decide_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      decide_sessions: {
        Row: {
          category: string | null
          code: string
          created_at: string
          created_by: string
          id: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          created_by: string
          id?: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          created_by?: string
          id?: string
        }
        Relationships: []
      }
      decide_votes: {
        Row: {
          created_at: string
          liked: boolean
          restaurant_id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          liked: boolean
          restaurant_id: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          liked?: boolean
          restaurant_id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decide_votes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decide_votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "decide_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_ratings: {
        Row: {
          created_at: string
          menu_item_id: string
          rating: number
          restaurant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          menu_item_id: string
          rating: number
          restaurant_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          menu_item_id?: string
          rating?: number
          restaurant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_ratings_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      drops: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          kind: string
          original_price_cents: number | null
          photo_url: string | null
          price_cents: number
          quantity_left: number
          quantity_total: number
          restaurant_id: string
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          original_price_cents?: number | null
          photo_url?: string | null
          price_cents?: number
          quantity_left?: number
          quantity_total?: number
          restaurant_id: string
          starts_at?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          original_price_cents?: number | null
          photo_url?: string | null
          price_cents?: number
          quantity_left?: number
          quantity_total?: number
          restaurant_id?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "drops_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      food_donations: {
        Row: {
          created_at: string
          drop_id: string | null
          id: string
          quantity: number
          recipient: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          drop_id?: string | null
          id?: string
          quantity: number
          recipient: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          drop_id?: string | null
          id?: string
          quantity?: number
          recipient?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_donations_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_donations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      forward_meals: {
        Row: {
          amount_cents: number
          created_at: string
          given_at: string | null
          id: string
          label: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          given_at?: string | null
          id?: string
          label: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          given_at?: string | null
          id?: string
          label?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forward_meals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          id: string
          name: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          dish_type: string | null
          id: string
          is_available: boolean
          is_house_special: boolean
          is_secret: boolean
          name: string
          photo_url: string | null
          price_cents: number
          required_level: number
          restaurant_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          dish_type?: string | null
          id?: string
          is_available?: boolean
          is_house_special?: boolean
          is_secret?: boolean
          name: string
          photo_url?: string | null
          price_cents?: number
          required_level?: number
          restaurant_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          dish_type?: string | null
          id?: string
          is_available?: boolean
          is_house_special?: boolean
          is_secret?: boolean
          name?: string
          photo_url?: string | null
          price_cents?: number
          required_level?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          item_name: string
          menu_item_id: string | null
          order_id: string
          price_cents: number
          quantity: number
        }
        Insert: {
          id?: string
          item_name?: string
          menu_item_id?: string | null
          order_id: string
          price_cents?: number
          quantity?: number
        }
        Update: {
          id?: string
          item_name?: string
          menu_item_id?: string | null
          order_id?: string
          price_cents?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string
          drop_id: string | null
          id: string
          note: string
          order_number: string
          payment_mode: string
          pickup_time: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
          total_cents: number
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name?: string
          drop_id?: string | null
          id?: string
          note?: string
          order_number?: string
          payment_mode?: string
          pickup_time?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          drop_id?: string | null
          id?: string
          note?: string
          order_number?: string
          payment_mode?: string
          pickup_time?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          photo_url: string | null
          promo_code: string | null
          restaurant_id: string
          starts_at: string
          title: string
          unlock_temp_c: number
          vortex_only: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          photo_url?: string | null
          promo_code?: string | null
          restaurant_id: string
          starts_at?: string
          title: string
          unlock_temp_c?: number
          vortex_only?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          photo_url?: string | null
          promo_code?: string | null
          restaurant_id?: string
          starts_at?: string
          title?: string
          unlock_temp_c?: number
          vortex_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "promotions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_secrets: {
        Row: {
          restaurant_id: string
          stamp_secret: string
        }
        Insert: {
          restaurant_id: string
          stamp_secret?: string
        }
        Update: {
          restaurant_id?: string
          stamp_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_secrets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          accepting_orders: boolean
          address: string | null
          busy_level: string | null
          busy_updated_at: string | null
          category: string
          cover_url: string | null
          created_at: string
          description: string | null
          free_until: string | null
          hours: Json
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          neighbourhood: string | null
          owner_id: string | null
          pay_it_forward: boolean
          phone: string | null
          slug: string
          wait_minutes: number | null
        }
        Insert: {
          accepting_orders?: boolean
          address?: string | null
          busy_level?: string | null
          busy_updated_at?: string | null
          category?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          free_until?: string | null
          hours?: Json
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          neighbourhood?: string | null
          owner_id?: string | null
          pay_it_forward?: boolean
          phone?: string | null
          slug: string
          wait_minutes?: number | null
        }
        Update: {
          accepting_orders?: boolean
          address?: string | null
          busy_level?: string | null
          busy_updated_at?: string | null
          category?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          free_until?: string | null
          hours?: Json
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          neighbourhood?: string | null
          owner_id?: string | null
          pay_it_forward?: boolean
          phone?: string | null
          slug?: string
          wait_minutes?: number | null
        }
        Relationships: []
      }
      review_reports: {
        Row: {
          created_at: string
          reason: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reason?: string
          review_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          reason?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          owner_replied_at: string | null
          owner_reply: string | null
          photo_urls: string[]
          rating: number
          restaurant_id: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          owner_replied_at?: string | null
          owner_reply?: string | null
          photo_urls?: string[]
          rating: number
          restaurant_id: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          owner_replied_at?: string | null
          owner_reply?: string | null
          photo_urls?: string[]
          rating?: number
          restaurant_id?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      stamps: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          restaurant_id: string
          source: Database["public"]["Enums"]["stamp_source"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          restaurant_id: string
          source?: Database["public"]["Enums"]["stamp_source"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          restaurant_id?: string
          source?: Database["public"]["Enums"]["stamp_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stamps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
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
      dish_leaderboard: {
        Row: {
          avg_rating: number | null
          dish_type: string | null
          menu_item_id: string | null
          name: string | null
          neighbourhood: string | null
          photo_url: string | null
          price_cents: number | null
          rating_count: number | null
          restaurant_id: string | null
          restaurant_name: string | null
          restaurant_slug: string | null
          score: number | null
        }
        Relationships: []
      }
      restaurant_ratings: {
        Row: {
          avg_rating: number | null
          restaurant_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      buy_forward: {
        Args: { p_amount_cents: number; p_label: string; p_restaurant_id: string }
        Returns: string
      }
      city_impact: {
        Args: never
        Returns: {
          meals_donated: number
          meals_paid_forward: number
          meals_rescued: number
        }[]
      }
      claim_drop: { Args: { p_drop_id: string }; Returns: string }
      claim_visit_stamp: {
        Args: { p_code: string; p_slug: string }
        Returns: {
          restaurant_name: string
          restaurant_slug: string
        }[]
      }
      checkout_test_order: {
        Args: {
          p_items: Json
          p_note: string
          p_order_id: string
          p_pickup_time?: string
          p_restaurant_id: string
        }
        Returns: string
      }
      create_decide_session: {
        Args: { p_category?: string }
        Returns: {
          code: string
          id: string
        }[]
      }
      donate_leftover: {
        Args: { p_drop_id: string; p_recipient: string }
        Returns: number
      }
      forward_counts: {
        Args: never
        Returns: {
          given: number
          restaurant_id: string
          waiting: number
        }[]
      }
      get_stamp_code: {
        Args: { p_restaurant_id: string }
        Returns: {
          code: string
          expires_at: string
        }[]
      }
      give_forward: { Args: { p_restaurant_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_decide_member: { Args: { _session_id: string }; Returns: boolean }
      join_decide_session: { Args: { p_code: string }; Returns: string }
      level_for: { Args: { _stamps: number }; Returns: number }
      live_queue: {
        Args: never
        Returns: {
          active_orders: number
          restaurant_id: string
        }[]
      }
      my_level: { Args: never; Returns: number }
      owns_restaurant: { Args: { _restaurant_id: string }; Returns: boolean }
      redeem_reward: {
        Args: { p_restaurant_id: string }
        Returns: {
          created_at: string
          id: string
        }[]
      }
      reply_to_review: {
        Args: { p_reply: string; p_review_id: string }
        Returns: undefined
      }
      secret_menu_teaser: {
        Args: { p_restaurant_id: string }
        Returns: {
          locked_count: number
          next_level: number
        }[]
      }
      taste_twin_picks: {
        Args: never
        Returns: {
          restaurant_id: string
          score: number
          twins: number
        }[]
      }
      trending_spots: {
        Args: { p_days?: number }
        Returns: {
          follows: number
          orders: number
          restaurant_id: string
          reviews: number
          score: number
          stamps: number
        }[]
      }
    }
    Enums: {
      app_role: "customer" | "restaurant_owner" | "admin"
      order_status:
        | "pending"
        | "paid"
        | "preparing"
        | "ready"
        | "picked_up"
        | "cancelled"
      stamp_source: "visit" | "order" | "drop"
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
      app_role: ["customer", "restaurant_owner", "admin"],
      order_status: [
        "pending",
        "paid",
        "preparing",
        "ready",
        "picked_up",
        "cancelled",
      ],
      stamp_source: ["visit", "order", "drop"],
    },
  },
} as const
