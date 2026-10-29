import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Crawl = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  cover_url: string | null;
  reward: string | null;
  crawl_stops: {
    position: number;
    tip: string | null;
    restaurant_id: string;
    restaurants: {
      name: string;
      slug: string;
      neighbourhood: string | null;
      cover_url: string | null;
      lat: number | null;
      lng: number | null;
      category: string;
    } | null;
  }[];
};

export function useCrawls() {
  return useQuery({
    queryKey: ["crawls"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crawls")
        .select(
          "id, slug, title, description, emoji, cover_url, reward, crawl_stops(position, tip, restaurant_id, restaurants(name, slug, neighbourhood, cover_url, lat, lng, category))",
        )
        .order("created_at");
      if (error) throw error;
      return ((data ?? []) as Crawl[]).map((c) => ({
        ...c,
        crawl_stops: [...c.crawl_stops].sort((a, b) => a.position - b.position),
      }));
    },
  });
}

/** Restaurants the user has a stamp at (any time). */
export function useStampedSpots(userId: string | undefined) {
  return useQuery({
    queryKey: ["stamped-spots", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return new Set<string>();
      const { data, error } = await supabase
        .from("stamps")
        .select("restaurant_id")
        .eq("user_id", userId);
      if (error) throw error;
      return new Set((data ?? []).map((s) => s.restaurant_id));
    },
  });
}

export function routeLink(c: Crawl) {
  const pts = c.crawl_stops
    .map((s) => s.restaurants)
    .filter((r) => r?.lat != null && r?.lng != null) as { lat: number; lng: number }[];
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1] as { lat: number; lng: number };
  const way = pts
    .slice(0, -1)
    .map((p) => `${p.lat},${p.lng}`)
    .join("|");
  return `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${last.lat},${last.lng}&waypoints=${encodeURIComponent(way)}`;
}
