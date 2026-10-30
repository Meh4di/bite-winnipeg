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
      activity: {
        Row: {
          badge_id: string | null
          created_at: string
          id: string
          kind: string
          rating: number | null
          restaurant_id: string | null
          user_id: string
        }
        Insert: {
          badge_id?: string | null
          created_at?: string
          id?: string
          kind: string
          rating?: number | null
          restaurant_id?: string | null
          user_id: string
        }
        Update: {
          badge_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          rating?: number | null
          restaurant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_reactions: {
        Row: {
          activity_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          user_id?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_reactions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
        ]
      }
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
      business_verifications: {
        Row: {
          admin_note: string | null
          business_email: string | null
          business_number: string | null
          business_phone: string
          contact_name: string
          contact_role: string
          created_at: string
          doc_paths: string[]
          id: string
          kind: string
          legal_name: string
          permit_number: string | null
          restaurant_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          website: string | null
        }
        Insert: {
          admin_note?: string | null
          business_email?: string | null
          business_number?: string | null
          business_phone: string
          contact_name: string
          contact_role: string
          created_at?: string
          doc_paths?: string[]
          id?: string
          kind?: string
          legal_name: string
          permit_number?: string | null
          restaurant_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          website?: string | null
        }
        Update: {
          admin_note?: string | null
          business_email?: string | null
          business_number?: string | null
          business_phone?: string
          contact_name?: string
          contact_role?: string
          created_at?: string
          doc_paths?: string[]
          id?: string
          kind?: string
          legal_name?: string
          permit_number?: string | null
          restaurant_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_verifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      listing_reports: {
        Row: {
          created_at: string
          id: string
          note: string | null
          reason: string
          reporter_id: string
          resolved: boolean
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          reason: string
          reporter_id?: string
          resolved?: boolean
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          reason?: string
          reporter_id?: string
          resolved?: boolean
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_reports_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      meetup_members: {
        Row: {
          joined_at: string
          meetup_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          meetup_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          meetup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetup_members_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
        ]
      }
      meetups: {
        Row: {
          created_at: string
          host_id: string
          id: string
          note: string | null
          restaurant_id: string
          seats: number
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          host_id: string
          id?: string
          note?: string | null
          restaurant_id: string
          seats: number
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          host_id?: string
          id?: string
          note?: string | null
          restaurant_id?: string
          seats?: number
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetups_restaurant_id_fkey"
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
          is_small_plate: boolean
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
          is_small_plate?: boolean
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
          is_small_plate?: boolean
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
      profile_private: {
        Row: {
          birth_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          birth_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          discoverable: boolean
          full_name: string | null
          id: string
          share_activity: boolean
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          discoverable?: boolean
          full_name?: string | null
          id: string
          share_activity?: boolean
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          discoverable?: boolean
          full_name?: string | null
          id?: string
          share_activity?: boolean
          username?: string | null
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
          is_sample: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          neighbourhood: string | null
          owner_id: string | null
          pay_it_forward: boolean
          phone: string | null
          slug: string
          verification_status: string
          verified_at: string | null
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
          is_sample?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          neighbourhood?: string | null
          owner_id?: string | null
          pay_it_forward?: boolean
          phone?: string | null
          slug: string
          verification_status?: string
          verified_at?: string | null
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
          is_sample?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          neighbourhood?: string | null
          owner_id?: string | null
          pay_it_forward?: boolean
          phone?: string | null
          slug?: string
          verification_status?: string
          verified_at?: string | null
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
      unlock_deals: {
        Row: {
          cancelled: boolean
          created_at: string
          deal_price_cents: number
          description: string | null
          ends_at: string
          goal: number
          id: string
          max_spots: number
          photo_url: string | null
          pickup_until: string
          regular_price_cents: number
          restaurant_id: string
          title: string
        }
        Insert: {
          cancelled?: boolean
          created_at?: string
          deal_price_cents: number
          description?: string | null
          ends_at: string
          goal: number
          id?: string
          max_spots: number
          photo_url?: string | null
          pickup_until: string
          regular_price_cents: number
          restaurant_id: string
          title: string
        }
        Update: {
          cancelled?: boolean
          created_at?: string
          deal_price_cents?: number
          description?: string | null
          ends_at?: string
          goal?: number
          id?: string
          max_spots?: number
          photo_url?: string | null
          pickup_until?: string
          regular_price_cents?: number
          restaurant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "unlock_deals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      unlock_pledges: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          redeemed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          redeemed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          redeemed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unlock_pledges_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "unlock_deals"
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
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id?: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id?: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          id: string
          meetup_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meetup_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          meetup_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
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
      admin_listing_reports: {
        Args: never
        Returns: {
          closed_reports: number
          is_active: boolean
          last_at: string
          notes: string[]
          reports: number
          restaurant_id: string
          restaurant_name: string
          restaurant_slug: string
          verification_status: string
        }[]
      }
      admin_resolve_listing: { Args: { p_hide: boolean; p_restaurant_id: string }; Returns: undefined }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      blocked_between: { Args: { _a: string; _b: string }; Returns: boolean }
      buy_forward: {
        Args: { p_amount_cents: number; p_label: string; p_restaurant_id: string }
        Returns: string
      }
      can_see_activity: { Args: { _at: string; _owner: string }; Returns: boolean }
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
      create_meetup: {
        Args: { p_note: string; p_restaurant_id: string; p_seats: number; p_starts_at: string; p_title: string }
        Returns: string
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
      is_admin: { Args: never; Returns: boolean }
      is_adult: { Args: { _user: string }; Returns: boolean }
      is_decide_member: { Args: { _session_id: string }; Returns: boolean }
      is_meetup_member: { Args: { _meetup: string }; Returns: boolean }
      is_verified_restaurant: { Args: { _restaurant_id: string }; Returns: boolean }
      join_decide_session: { Args: { p_code: string }; Returns: string }
      join_meetup: { Args: { p_meetup_id: string }; Returns: undefined }
      join_unlock: { Args: { p_deal_id: string }; Returns: number }
      leave_meetup: { Args: { p_meetup_id: string }; Returns: undefined }
      leave_unlock: { Args: { p_deal_id: string }; Returns: undefined }
      level_for: { Args: { _stamps: number }; Returns: number }
      list_meetups: {
        Args: never
        Returns: {
          host_id: string
          host_name: string
          id: string
          joined: boolean
          members: number
          note: string | null
          restaurant_id: string
          seats: number
          starts_at: string
          title: string
        }[]
      }
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
      redeem_unlock: { Args: { p_pledge_id: string }; Returns: undefined }
      reply_to_review: {
        Args: { p_reply: string; p_review_id: string }
        Returns: undefined
      }
      review_verification: {
        Args: { p_approve: boolean; p_id: string; p_note: string }
        Returns: undefined
      }
      secret_menu_teaser: {
        Args: { p_restaurant_id: string }
        Returns: {
          locked_count: number
          next_level: number
        }[]
      }
      social_summary: {
        Args: { p_user: string }
        Returns: {
          badges: number
          blocked: boolean
          followers: number
          following: number
          follows_me: boolean
          i_follow: boolean
          spots: number
          stamps: number
        }[]
      }
      submit_verification: {
        Args: {
          p_business_email: string
          p_business_number: string
          p_business_phone: string
          p_contact_name: string
          p_contact_role: string
          p_doc_paths: string[]
          p_legal_name: string
          p_permit_number: string
          p_restaurant_id: string
          p_website: string
        }
        Returns: string
      }
      taste_match: { Args: { p_other: string }; Returns: number | null }
      taste_match_people: {
        Args: never
        Returns: {
          score: number | null
          shared_spots: number
          user_id: string
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
      unlock_code: { Args: { _pledge: string }; Returns: string }
      unlock_pledge_list: {
        Args: { p_deal_id: string }
        Returns: {
          code: string
          created_at: string
          first_name: string
          pledge_id: string
          redeemed_at: string | null
        }[]
      }
      unlock_progress: {
        Args: never
        Returns: {
          deal_id: string
          joined: number
          mine: boolean
          my_code: string | null
          redeemed: boolean
        }[]
      }
      verification_queue: {
        Args: never
        Returns: {
          admin_note: string | null
          kind: string
          business_email: string | null
          business_number: string | null
          business_phone: string
          contact_name: string
          contact_role: string
          created_at: string
          doc_paths: string[]
          id: string
          legal_name: string
          owner_email: string | null
          permit_number: string | null
          restaurant_address: string | null
          restaurant_id: string
          restaurant_name: string
          restaurant_phone: string | null
          restaurant_slug: string
          status: string
          website: string | null
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
