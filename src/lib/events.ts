import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EventStats = {
  going: number;
  interested: number;
  my_status: "going" | "interested" | null;
  friends_going: number;
  friend_names: string[];
  deals: number;
};
export type BityEvent = EventRow & { stats: EventStats };

export const EVENT_CATEGORIES = [
  { key: "game", label: "Games", emoji: "🏒" },
  { key: "concert", label: "Music", emoji: "🎶" },
  { key: "festival", label: "Festivals", emoji: "🎉" },
  { key: "market", label: "Markets", emoji: "🧺" },
  { key: "popup", label: "Pop-ups", emoji: "🍜" },
  { key: "food-truck", label: "Food trucks", emoji: "🚚" },
  { key: "restaurant-night", label: "Restaurant nights", emoji: "🍽️" },
  { key: "cultural", label: "Cultural", emoji: "🌍" },
  { key: "community", label: "Community", emoji: "🤝" },
  { key: "other", label: "Other", emoji: "📅" },
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number]["key"];
const OTHER = { key: "other", label: "Other", emoji: "📅" } as const;
export const categoryOf = (k: string): { key: string; label: string; emoji: string } =>
  EVENT_CATEGORIES.find((c) => c.key === k) ?? OTHER;

export const EVENT_TAGS = [
  { key: "family", label: "Family-friendly" },
  { key: "halal", label: "Halal food" },
  { key: "vegan", label: "Vegan options" },
  { key: "19+", label: "19+" },
  { key: "outdoor", label: "Outdoors" },
  { key: "newcomer-friendly", label: "Newcomer-friendly" },
  { key: "accessible", label: "Accessible" },
] as const;

const EMPTY: EventStats = {
  going: 0,
  interested: 0,
  my_status: null,
  friends_going: 0,
  friend_names: [],
  deals: 0,
};

/** Upcoming approved events (and ones on right now), soonest first, with going/friends counts. */
export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    staleTime: 30_000,
    queryFn: async (): Promise<BityEvent[]> => {
      const [ev, st] = await Promise.all([
        supabase
          .from("events")
          .select("*")
          .eq("status", "approved")
          .gt("ends_at", new Date().toISOString())
          .order("starts_at")
          .limit(200),
        supabase.rpc("event_stats"),
      ]);
      if (ev.error) throw ev.error;
      const stats = new Map((st.data ?? []).map((s) => [s.event_id, s]));
      return (ev.data ?? []).map((e) => ({
        ...e,
        stats: { ...EMPTY, ...(stats.get(e.id) as Partial<EventStats> | undefined) },
      }));
    },
  });
}

export function useEvent(id: string) {
  const all = useEvents();
  const single = useQuery({
    queryKey: ["event", id],
    enabled: !all.isLoading && !all.data?.some((e) => e.id === id),
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? ({ ...data, stats: EMPTY } as BityEvent) : null;
    },
  });
  const hit = all.data?.find((e) => e.id === id);
  return {
    data: hit ?? single.data ?? null,
    isLoading: all.isLoading || (!hit && single.isLoading),
  };
}

export type EventDeal = Database["public"]["Tables"]["event_deals"]["Row"] & {
  restaurants: { name: string; slug: string; category: string; logo_url: string | null } | null;
};

export function useEventDeals(eventId: string) {
  return useQuery({
    queryKey: ["event-deals", eventId],
    queryFn: async (): Promise<EventDeal[]> => {
      const { data, error } = await supabase
        .from("event_deals")
        .select("*, restaurants(name, slug, category, logo_url)")
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as EventDeal[];
    },
  });
}

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function isOnNow(e: EventRow, now = Date.now()) {
  return new Date(e.starts_at).getTime() <= now && new Date(e.ends_at).getTime() > now;
}

/** Happening at any point today (including events already running). */
export function isToday(e: EventRow, now = new Date()) {
  const s = new Date(e.starts_at).getTime();
  const end = startOfDay(now) + DAY;
  return s < end && new Date(e.ends_at).getTime() > now.getTime();
}

/** Friday evening through Sunday of this week (or the coming one). */
export function isThisWeekend(e: EventRow, now = new Date()) {
  const dow = now.getDay(); // 0 Sun … 6 Sat
  const toFri = dow === 0 ? -2 : 5 - dow;
  const fri = startOfDay(now) + toFri * DAY + 17 * 3600_000;
  const monday = startOfDay(now) + (toFri + 3) * DAY;
  const s = new Date(e.starts_at).getTime();
  return s < monday && new Date(e.ends_at).getTime() > Math.max(fri, now.getTime());
}

export function whenLabel(e: EventRow, now = new Date()) {
  const s = new Date(e.starts_at);
  if (isOnNow(e, now.getTime())) return "On now";
  const time = s.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  const days = Math.round((startOfDay(s) - startOfDay(now)) / DAY);
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  if (days < 7) return `${s.toLocaleDateString("en-CA", { weekday: "long" })} · ${time}`;
  return `${s.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}

export function priceLabel(e: EventRow) {
  return e.is_free ? "Free" : (e.price_text ?? null);
}

/** Straight-line distance in km, for "Eat near this event". */
export function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export async function rsvp(eventId: string, status: "going" | "interested" | null) {
  const { error } = await supabase.rpc("rsvp_event", { p_event_id: eventId, p_status: status });
  if (error) throw error;
}
