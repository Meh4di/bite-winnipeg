import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHouseSpecials, useLiveQueue, useRatings } from "@/lib/community";
import { dropState, useDrops, useNow } from "@/lib/live";
import { useHeat } from "@/lib/map";

const MapView = lazy(() => import("@/components/bite/MapView"));

export const Route = createFileRoute("/_tabs/map")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Map — Bity" },
      {
        name: "description",
        content:
          "Winnipeg's live food map: the best spots voted by locals, what's hot this week, what's open now, and deals.",
      },
      { property: "og:title", content: "Map — Bity" },
      { property: "og:description", content: "Winnipeg food map with live busyness and deals." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const qc = useQueryClient();
  const now = useNow(30_000);
  const ratings = useRatings();
  const queue = useLiveQueue();
  const specials = useHouseSpecials();
  const drops = useDrops();
  const heat = useHeat();

  const spots = useQuery({
    queryKey: ["restaurants", "map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select(
          "id, slug, name, category, neighbourhood, address, cover_url, lat, lng, hours, busy_level, wait_minutes, busy_updated_at, verification_status, is_sample",
        )
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Busy levels update live as owners tap them.
  useEffect(() => {
    const channel = supabase
      .channel(`map-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurants" }, () =>
        qc.invalidateQueries({ queryKey: ["restaurants", "map"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const deals = useMemo(() => {
    const m = new Map<string, { drops: number; rescue: number }>();
    for (const d of drops.data ?? []) {
      if (dropState(d, now) !== "live") continue;
      const cur = m.get(d.restaurant_id) ?? { drops: 0, rescue: 0 };
      if (d.kind === "leftover") cur.rescue += 1;
      else cur.drops += 1;
      m.set(d.restaurant_id, cur);
    }
    return m;
  }, [drops.data, now]);

  const loading = <div className="h-[calc(100dvh-5rem)] w-full animate-pulse bg-muted" />;
  if (!spots.data) return loading;

  return (
    <Suspense fallback={loading}>
      <MapView
        spots={spots.data}
        now={now}
        extras={{
          ratings: ratings.data ?? new Map(),
          queue: queue.data ?? new Map(),
          specials: specials.data ?? new Map(),
          deals,
          heat: heat.data ?? new Map(),
        }}
      />
    </Suspense>
  );
}
