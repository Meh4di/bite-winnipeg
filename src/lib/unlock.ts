import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UnlockDeal = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  regular_price_cents: number;
  deal_price_cents: number;
  goal: number;
  max_spots: number;
  ends_at: string;
  pickup_until: string;
  cancelled: boolean;
  restaurants: {
    name: string;
    slug: string;
    neighbourhood: string | null;
    cover_url: string | null;
    category: string;
  } | null;
  joined: number;
  mine: boolean;
  my_code: string | null;
  redeemed: boolean;
};

export type UnlockState = "open" | "unlocked" | "closed-unlocked" | "failed" | "full" | "cancelled";

export function unlockState(d: UnlockDeal, now = Date.now()): UnlockState {
  if (d.cancelled) return "cancelled";
  const reached = d.joined >= d.goal;
  if (now >= new Date(d.ends_at).getTime()) return reached ? "closed-unlocked" : "failed";
  if (d.joined >= d.max_spots) return "full";
  return reached ? "unlocked" : "open";
}

export const isReached = (s: UnlockState) =>
  s === "unlocked" || s === "closed-unlocked" || s === "full";

export const percentOff = (d: Pick<UnlockDeal, "regular_price_cents" | "deal_price_cents">) =>
  Math.round((1 - d.deal_price_cents / d.regular_price_cents) * 100);

export function countdown(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "0m";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Winnipeg",
  }).format(new Date(iso));

/** Live unlock deals (and ones whose pickup ended in the last day) with progress. */
export function useUnlockDeals(opts: { restaurantId?: string; dealId?: string } = {}) {
  return useQuery({
    queryKey: ["unlock-deals", opts.restaurantId ?? null, opts.dealId ?? null],
    refetchInterval: 30_000,
    queryFn: async (): Promise<UnlockDeal[]> => {
      let q = supabase
        .from("unlock_deals")
        .select("*, restaurants(name, slug, neighbourhood, cover_url, category)")
        .gt("pickup_until", new Date(Date.now() - 86400000).toISOString())
        .order("ends_at");
      if (opts.restaurantId) q = q.eq("restaurant_id", opts.restaurantId);
      if (opts.dealId) q = q.eq("id", opts.dealId);
      const [{ data, error }, prog] = await Promise.all([q, supabase.rpc("unlock_progress")]);
      if (error) throw error;
      const byId = new Map((prog.data ?? []).map((p) => [p.deal_id, p]));
      return (data ?? []).map((d) => {
        const p = byId.get(d.id);
        return {
          ...d,
          joined: p?.joined ?? 0,
          mine: p?.mine ?? false,
          my_code: p?.my_code ?? null,
          redeemed: p?.redeemed ?? false,
        } as UnlockDeal;
      });
    },
  });
}
