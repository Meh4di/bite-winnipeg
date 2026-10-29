import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Re-renders every `ms` so countdowns stay current. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** "2h 14m", "12:03", "45s" */
export function countdown(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}:${String(sec).padStart(2, "0")}`;
  return `${sec}s`;
}

export function clockTime(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Winnipeg",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export type DropRow = {
  id: string;
  restaurant_id: string;
  kind: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  price_cents: number;
  original_price_cents: number | null;
  quantity_total: number;
  quantity_left: number;
  starts_at: string;
  ends_at: string | null;
  restaurants: {
    name: string;
    slug: string;
    logo_url: string | null;
    category: string;
    neighbourhood: string | null;
  } | null;
};

export type DropState = "upcoming" | "live" | "soldout" | "ended";

export function dropState(
  d: Pick<DropRow, "starts_at" | "ends_at" | "quantity_left">,
  now = Date.now(),
): DropState {
  if (d.ends_at && new Date(d.ends_at).getTime() <= now) return "ended";
  if (new Date(d.starts_at).getTime() > now) return "upcoming";
  if (d.quantity_left <= 0) return "soldout";
  return "live";
}

const DROP_SELECT =
  "id, restaurant_id, kind, title, description, photo_url, price_cents, original_price_cents, quantity_total, quantity_left, starts_at, ends_at, restaurants(name, slug, logo_url, category, neighbourhood)";

/** Drops and last-call deals that are live, upcoming (next 7 days) or ended in the last hour. Updates live. */
export function useDrops(restaurantId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`drops-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "drops" }, () =>
        qc.invalidateQueries({ queryKey: ["drops"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
  return useQuery({
    queryKey: ["drops", restaurantId ?? "all"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const soon = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
      let q = supabase
        .from("drops")
        .select(DROP_SELECT)
        .lte("starts_at", soon)
        .or(`ends_at.is.null,ends_at.gt.${recent}`)
        .order("starts_at");
      if (restaurantId) q = q.eq("restaurant_id", restaurantId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DropRow[];
    },
  });
}

export type PromoRow = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  promo_code: string | null;
  vortex_only: boolean;
  unlock_temp_c: number;
  starts_at: string;
  ends_at: string | null;
  restaurants: { name: string; slug: string; logo_url: string | null; category: string } | null;
};

/** Promotions running right now. */
export function usePromotions(restaurantId?: string) {
  return useQuery({
    queryKey: ["promotions", restaurantId ?? "all"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const now = new Date().toISOString();
      let q = supabase
        .from("promotions")
        .select(
          "id, restaurant_id, title, description, photo_url, promo_code, vortex_only, unlock_temp_c, starts_at, ends_at, restaurants(name, slug, logo_url, category)",
        )
        .lte("starts_at", now)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order("starts_at", { ascending: false });
      if (restaurantId) q = q.eq("restaurant_id", restaurantId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PromoRow[];
    },
  });
}
