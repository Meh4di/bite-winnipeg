import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DISH_TYPES = [
  { key: "Latte", emoji: "☕" },
  { key: "Coffee", emoji: "🫖" },
  { key: "Croissant", emoji: "🥐" },
  { key: "Pastry", emoji: "🧁" },
  { key: "Donut", emoji: "🍩" },
  { key: "Taco", emoji: "🌮" },
  { key: "Pizza", emoji: "🍕" },
  { key: "Ramen", emoji: "🍜" },
  { key: "Noodles", emoji: "🥢" },
  { key: "Dumplings", emoji: "🥟" },
  { key: "Sushi", emoji: "🍣" },
  { key: "Bubble tea", emoji: "🧋" },
  { key: "Burger", emoji: "🍔" },
  { key: "Pancakes", emoji: "🥞" },
  { key: "Brunch", emoji: "🍳" },
  { key: "Sandwich", emoji: "🥪" },
  { key: "Pie", emoji: "🥧" },
  { key: "Dessert", emoji: "🍰" },
] as const;

export const dishEmoji = (t: string | null) => DISH_TYPES.find((d) => d.key === t)?.emoji ?? "🍽️";

export type LeaderRow = {
  menu_item_id: string;
  name: string;
  dish_type: string;
  photo_url: string | null;
  price_cents: number;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_slug: string;
  neighbourhood: string | null;
  rating_count: number;
  avg_rating: number;
  score: number;
};

/** Every rated dish, best first, with its rank inside its dish type. */
export function useDishLeaderboard() {
  return useQuery({
    queryKey: ["dish-leaderboard"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dish_leaderboard")
        .select("*")
        .order("score", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as LeaderRow[];
      const rank = new Map<string, number>();
      const seen = new Map<string, number>();
      for (const r of rows) {
        const n = (seen.get(r.dish_type) ?? 0) + 1;
        seen.set(r.dish_type, n);
        rank.set(r.menu_item_id, n);
      }
      return { rows, rank };
    },
  });
}

/** Ratings for one restaurant's dishes, plus what the signed-in user gave. */
export function useDishRatings(restaurantId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["dish-ratings", restaurantId, userId ?? "anon"],
    enabled: !!restaurantId,
    queryFn: async () => {
      if (!restaurantId)
        return {
          stats: new Map<string, { avg: number; count: number }>(),
          mine: new Map<string, number>(),
        };
      const { data, error } = await supabase
        .from("dish_ratings")
        .select("menu_item_id, user_id, rating")
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
      const sums = new Map<string, { sum: number; count: number }>();
      const mine = new Map<string, number>();
      for (const r of data ?? []) {
        const s = sums.get(r.menu_item_id) ?? { sum: 0, count: 0 };
        s.sum += r.rating;
        s.count += 1;
        sums.set(r.menu_item_id, s);
        if (userId && r.user_id === userId) mine.set(r.menu_item_id, r.rating);
      }
      const stats = new Map(
        [...sums].map(([k, v]) => [k, { avg: v.sum / v.count, count: v.count }]),
      );
      return { stats, mine };
    },
  });
}
