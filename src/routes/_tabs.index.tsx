import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronRight, Flame, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/bite";
import { RestaurantCard } from "@/components/bite/RestaurantCard";
import { useAuth } from "@/lib/auth";
import { dropState, useDrops, useNow } from "@/lib/live";

export const Route = createFileRoute("/_tabs/")({
  head: () => ({
    meta: [
      { title: "Bite — Discover Winnipeg restaurants & cafes" },
      { name: "description", content: "Find Winnipeg cafes, bakeries, taco spots and more. See what's open now and browse menus." },
      { property: "og:title", content: "Bite — Discover Winnipeg restaurants & cafes" },
      { property: "og:description", content: "Find Winnipeg cafes, bakeries, taco spots and more." },
    ],
  }),
  component: Home,
});

function Home() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const { user } = useAuth();
  const name = (user?.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0];

  const { data, isLoading } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, slug, name, category, neighbourhood, cover_url, logo_url, hours")
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const now = useNow(10_000);
  const drops = useDrops();
  const liveDrops = (drops.data ?? []).filter((d) => dropState(d, now) === "live");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter(
      (r) =>
        (!cat || r.category === cat) &&
        (!s || [r.name, r.category, r.neighbourhood].some((v) => v?.toLowerCase().includes(s))),
    );
  }, [data, q, cat]);

  return (
    <div className="animate-screen">
      <header className="px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <p className="text-sm font-medium text-muted-foreground">
          {name ? `Hey ${name} 👋` : "Hey Winnipeg 👋"}
        </p>
        <h1 className="mt-1 text-[2rem] font-extrabold leading-[1.05]">
          What are we <span className="text-primary">biting</span> today?
        </h1>
        <label className="mt-5 flex h-13 items-center gap-3 rounded-2xl bg-card px-4 shadow-card">
          <Search className="size-5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search spots, food, neighbourhoods"
            className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search" className="p-1">
              <X className="size-4" />
            </button>
          )}
        </label>
      </header>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {CATEGORIES.map((c) => {
          const active = cat === c.name;
          return (
            <button
              key={c.name}
              onClick={() => setCat(active ? null : c.name)}
              className={`flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all active:scale-95 ${
                active ? "bg-primary text-primary-foreground shadow-pop" : "bg-card text-foreground shadow-card"
              }`}
            >
              <span className="text-lg">{c.emoji}</span>
              {c.name}
            </button>
          );
        })}
      </div>

      {liveDrops.length > 0 && (
        <Link
          to="/drops"
          className="mx-5 mt-5 flex items-center gap-3 rounded-2xl bg-warm p-4 text-primary-foreground shadow-pop active:scale-[0.98]"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-primary-foreground/20">
            <Flame className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">
              {liveDrops.length} {liveDrops.length === 1 ? "drop" : "drops"} live now
            </p>
            <p className="truncate text-sm opacity-90">
              {liveDrops[0]?.title} at {liveDrops[0]?.restaurants?.name}
            </p>
          </div>
          <ChevronRight className="size-5" />
        </Link>
      )}

      <section className="mt-6 px-5">
        <Link
          to="/map"
          className="mb-4 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card active:scale-[0.98]"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-2xl">🗺️</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Map view</p>
            <p className="truncate text-sm text-muted-foreground">See what's near you, how busy it is, and the wait</p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">{cat ?? "Near you"}</h2>
          <span className="text-sm text-muted-foreground">{list.length} {list.length === 1 ? "spot" : "spots"}</span>
        </div>
        <div className="space-y-4">
          {isLoading &&
            [0, 1, 2].map((i) => <div key={i} className="h-64 animate-pulse rounded-3xl bg-muted" />)}
          {list.map((r) => (
            <RestaurantCard key={r.id} r={r} />
          ))}
          {!isLoading && list.length === 0 && (
            <div className="rounded-3xl bg-card p-8 text-center shadow-card">
              <p className="text-4xl">🥲</p>
              <p className="mt-2 font-semibold">Nothing here yet</p>
              <p className="text-sm text-muted-foreground">Try another search or category.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
