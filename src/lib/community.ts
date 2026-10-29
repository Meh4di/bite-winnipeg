import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BusyLevel = "quiet" | "steady" | "busy" | "packed";

export const BUSY: Record<BusyLevel, { label: string; emoji: string; dot: string; pill: string }> =
  {
    quiet: {
      label: "Quiet",
      emoji: "🟢",
      dot: "#16a34a",
      pill: "bg-success text-success-foreground",
    },
    steady: { label: "Steady", emoji: "🟡", dot: "#ca8a04", pill: "bg-amber-500 text-white" },
    busy: { label: "Busy", emoji: "🟠", dot: "#ea580c", pill: "bg-orange-600 text-white" },
    packed: { label: "Packed", emoji: "🔴", dot: "#dc2626", pill: "bg-red-700 text-white" },
  };

/** Owner updates count as "live" for 2 hours, then they're hidden so stale info never shows. */
export const BUSY_FRESH_MS = 2 * 60 * 60 * 1000;

export type BusyInfo = { level: BusyLevel | null; wait: number | null; updatedAt: string | null };

export function liveBusy(
  r: { busy_level: string | null; wait_minutes: number | null; busy_updated_at: string | null },
  now = Date.now(),
): BusyInfo | null {
  if (!r.busy_updated_at || now - new Date(r.busy_updated_at).getTime() > BUSY_FRESH_MS)
    return null;
  if (!r.busy_level && r.wait_minutes === null) return null;
  return {
    level: (r.busy_level as BusyLevel | null) ?? null,
    wait: r.wait_minutes,
    updatedAt: r.busy_updated_at,
  };
}

export function minutesAgo(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export const LIKE_TAGS = [
  "Great food",
  "Great value",
  "Friendly staff",
  "Fast",
  "Cozy vibe",
  "Big portions",
] as const;
export const DISLIKE_TAGS = [
  "Pricey",
  "Slow",
  "Small portions",
  "Cold food",
  "Too loud",
  "Messed up order",
] as const;
export const isLikeTag = (t: string) => (LIKE_TAGS as readonly string[]).includes(t);

/** Average rating and review count for every restaurant. */
export function useRatings() {
  return useQuery({
    queryKey: ["ratings"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurant_ratings").select("*");
      if (error) throw error;
      return new Map(
        (data ?? [])
          .filter((r) => r.restaurant_id)
          .map((r) => [
            r.restaurant_id as string,
            { avg: r.avg_rating ?? 0, count: r.review_count ?? 0 },
          ]),
      );
    },
  });
}

/** Pickup orders each kitchen is working on right now. */
export function useLiveQueue() {
  return useQuery({
    queryKey: ["live-queue"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("live_queue");
      if (error) throw error;
      return new Map((data ?? []).map((q) => [q.restaurant_id, q.active_orders]));
    },
  });
}

/** Each restaurant's house special. */
export function useHouseSpecials() {
  return useQuery({
    queryKey: ["house-specials"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, restaurant_id, name, price_cents, photo_url")
        .eq("is_house_special", true)
        .eq("is_available", true);
      if (error) throw error;
      return new Map((data ?? []).map((m) => [m.restaurant_id, m]));
    },
  });
}
