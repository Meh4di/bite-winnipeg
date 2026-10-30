import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ValueItem = {
  id: string;
  name: string;
  price_cents: number;
  photo_url: string | null;
  dish_type: string | null;
  is_small_plate: boolean;
  restaurants: {
    name: string;
    slug: string;
    neighbourhood: string | null;
    category: string;
    is_active: boolean;
  } | null;
};

/** Menu items at or under a price, from live (verified) spots, cheapest first. */
export function useValueItems(maxCents = 1500) {
  return useQuery({
    queryKey: ["value-items", maxCents],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ValueItem[]> => {
      const { data, error } = await supabase
        .from("menu_items")
        .select(
          "id, name, price_cents, photo_url, dish_type, is_small_plate, restaurants!inner(name, slug, neighbourhood, category, is_active)",
        )
        .eq("is_available", true)
        .eq("is_secret", false)
        .eq("restaurants.is_active", true)
        .lte("price_cents", maxCents)
        .gt("price_cents", 0)
        .order("price_cents")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ValueItem[];
    },
  });
}

export const HONEST_PROMISES = [
  { emoji: "✅", text: "The price you see is the price you pay" },
  { emoji: "🙅", text: "No tip screens" },
  { emoji: "🍁", text: "Local, verified spots" },
] as const;
