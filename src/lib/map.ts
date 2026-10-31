import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** "Best in the Peg" categories people can vote on. `match` suggests likely spots first. */
export const BEST_CATEGORIES = [
  { key: "smash-burger", label: "Smash burger", emoji: "🍔", match: ["Burgers", "Brunch"] },
  { key: "pizza", label: "Pizza", emoji: "🍕", match: ["Pizza"] },
  { key: "tacos", label: "Tacos", emoji: "🌮", match: ["Tacos"] },
  { key: "noodles", label: "Pho & ramen", emoji: "🍜", match: ["Asian"] },
  { key: "coffee", label: "Coffee", emoji: "☕", match: ["Coffee", "Bakery"] },
  { key: "bakery", label: "Bakery", emoji: "🥐", match: ["Bakery"] },
  { key: "brunch", label: "Brunch", emoji: "🥞", match: ["Brunch"] },
  { key: "ice-cream", label: "Ice cream", emoji: "🍦", match: ["Dessert"] },
  { key: "drinks", label: "Drinks", emoji: "🍹", match: ["Bistro", "Coffee"] },
] as const;
export type BestKey = (typeof BEST_CATEGORIES)[number]["key"];

export type Heat = {
  heat: number;
  visits_week: number;
  reviews: number;
  hot_item: string | null;
  /** 0..1 compared with the busiest spot this week */
  level: number;
};

export function useHeat() {
  return useQuery({
    queryKey: ["map-heat"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("map_heat");
      if (error) throw error;
      const max = Math.max(1, ...(data ?? []).map((d) => d.heat));
      return new Map<string, Heat>(
        (data ?? []).map((d) => [d.restaurant_id, { ...d, level: d.heat / max }]),
      );
    },
  });
}

export function useBestSpots(category: BestKey | null) {
  return useQuery({
    queryKey: ["best-spots", category],
    enabled: !!category,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("best_spots", { p_category: category! });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyVotes(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-votes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("spot_votes").select("category, restaurant_id");
      if (error) throw error;
      return new Map((data ?? []).map((v) => [v.category, v.restaurant_id]));
    },
  });
}

/** Privacy-safe interest count: only a tap inside Bity, deduplicated per person per hour. */
export function logSpotEvent(restaurantId: string, kind: "view" | "directions") {
  void supabase.auth.getSession().then(({ data }) => {
    if (data.session)
      void supabase.rpc("log_spot_event", { p_restaurant_id: restaurantId, p_kind: kind });
  });
}

export const MEDALS = ["🥇", "🥈", "🥉"];
