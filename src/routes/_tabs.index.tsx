import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronRight, MapPin, Search, Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, emojiFor, formatPrice } from "@/lib/bite";
import { RestaurantCard, type CardExtras } from "@/components/bite/RestaurantCard";
import { VortexBanner, useVortexDeals } from "@/components/bite/Vortex";
import { HomeHero, type HeroSlide } from "@/components/bite/HomeHero";
import { useAuth } from "@/lib/auth";
import { clockTime, countdown, dropState, useDrops, useNow } from "@/lib/live";
import { liveBusy, useHouseSpecials, useRatings } from "@/lib/community";
import { dishEmoji, useDishLeaderboard } from "@/lib/dishes";
import { useCrawls } from "@/lib/crawls";
import { useWinnipegWeather } from "@/lib/weather";
import { unlockState, useUnlockDeals } from "@/lib/unlock";
import { UnlockCard } from "@/components/bite/UnlockCard";
import { HONEST_PROMISES, useValueItems } from "@/lib/eats";
import { ValueCard } from "@/components/bite/ValueCard";

export const Route = createFileRoute("/_tabs/")({
  head: () => ({
    meta: [
      { title: "Bite — Discover Winnipeg restaurants & cafes" },
      {
        name: "description",
        content:
          "Winnipeg food drops, food rescue deals, the best dishes in the Peg, food crawls and live wait times.",
      },
      { property: "og:title", content: "Bite — Discover Winnipeg restaurants & cafes" },
      {
        property: "og:description",
        content: "Find Winnipeg cafes, bakeries, taco spots and more.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const { user } = useAuth();
  const name = (user?.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0];
  const now = useNow(10_000);
  const weather = useWinnipegWeather();
  const drops = useDrops();
  const ratings = useRatings();
  const specials = useHouseSpecials();
  const board = useDishLeaderboard();
  const crawls = useCrawls();
  const vortexDeals = useVortexDeals();
  const unlocks = useUnlockDeals();
  const value = useValueItems(1500);
  const liveUnlocks = (unlocks.data ?? []).filter((d) =>
    ["open", "unlocked"].includes(unlockState(d, now)),
  );
  const trending = useQuery({
    queryKey: ["trending"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("trending_spots", { p_days: 7 });
      if (error) throw error;
      return (data ?? []).filter((t) => t.score > 0);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["restaurants", "home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select(
          "id, slug, name, category, neighbourhood, cover_url, logo_url, hours, busy_level, wait_minutes, busy_updated_at",
        )
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const twins = useQuery({
    queryKey: ["taste-twins", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("taste_twin_picks");
      if (error) throw error;
      return data ?? [];
    },
  });

  const live = (drops.data ?? []).filter((d) => dropState(d, now) === "live");
  const liveDrops = live.filter((d) => d.kind === "drop");
  const rescue = live.filter((d) => d.kind === "leftover");
  const dealBy = (id: string): CardExtras["deal"] =>
    liveDrops.some((d) => d.restaurant_id === id)
      ? "drop"
      : rescue.some((d) => d.restaurant_id === id)
        ? "rescue"
        : null;
  const extras = (r: NonNullable<typeof data>[number]): CardExtras => ({
    rating: ratings.data?.get(r.id),
    busy: liveBusy(r, now),
    special: specials.data?.get(r.id)?.name,
    deal: dealBy(r.id),
  });

  const searching = !!q.trim() || !!cat;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter(
      (r) =>
        (!cat || r.category === cat) &&
        (!s || [r.name, r.category, r.neighbourhood].some((v) => v?.toLowerCase().includes(s))),
    );
  }, [data, q, cat]);

  const topDishes = useMemo(() => {
    const seen = new Set<string>();
    return (board.data?.rows ?? [])
      .filter((r) => (seen.has(r.dish_type) ? false : (seen.add(r.dish_type), true)))
      .slice(0, 8);
  }, [board.data]);
  const byId = new Map((data ?? []).map((r) => [r.id, r]));
  const twinSpots = (twins.data ?? [])
    .map((t) => ({ r: byId.get(t.restaurant_id), n: t.twins }))
    .filter((t) => t.r);
  const specialSpots = (data ?? []).filter((r) => specials.data?.has(r.id));
  const trendingSpots = (trending.data ?? [])
    .map((t) => ({ t, r: byId.get(t.restaurant_id) }))
    .filter((x) => x.r);

  const slides: HeroSlide[] = [];
  if (vortexDeals.vortex.active)
    slides.push({
      key: "vortex",
      eyebrow: "🥶 Polar Vortex mode",
      title: `Feels like ${vortexDeals.vortex.feelsLike}°C. Warm-up deals unlocked.`,
      sub: `${vortexDeals.unlocked.length} deals live right now`,
      image: null,
      emoji: "❄️",
      tone: "blue",
      to: "/drops",
      search: { tab: "vortex" },
    });
  const topDrop = liveDrops[0];
  if (topDrop)
    slides.push({
      key: "drop",
      eyebrow: "🔥 Live drop",
      title: topDrop.title,
      sub: `${topDrop.restaurants?.name} · only ${topDrop.quantity_left} left · ${formatPrice(topDrop.price_cents)}`,
      image: topDrop.photo_url,
      emoji: "🔥",
      tone: "red",
      to: "/drops",
    });
  const topRescue = rescue[0];
  if (topRescue)
    slides.push({
      key: "rescue",
      eyebrow: "♻️ Save food tonight",
      title: `${topRescue.original_price_cents ? Math.round((1 - topRescue.price_cents / topRescue.original_price_cents) * 100) + "% off " : ""}${topRescue.title.toLowerCase()}`,
      sub: `${topRescue.restaurants?.name} · rescue it before close`,
      image: topRescue.photo_url,
      emoji: "♻️",
      tone: "green",
      to: "/drops",
      search: { tab: "leftover" },
    });
  const topTrend = trendingSpots[0]?.r;
  if (topTrend)
    slides.push({
      key: "trend",
      eyebrow: "📈 #1 trending this week",
      title: topTrend.name,
      sub: `${topTrend.category} · ${topTrend.neighbourhood}`,
      image: topTrend.cover_url,
      emoji: "📈",
      tone: "dark",
      to: "/map",
    });
  const topCrawl = crawls.data?.[0];
  if (topCrawl)
    slides.push({
      key: "crawl",
      eyebrow: "🗺️ Food crawl",
      title: topCrawl.title,
      sub: topCrawl.reward
        ? `Finish it: ${topCrawl.reward.toLowerCase()}`
        : "Hit every stop for a reward",
      image: topCrawl.cover_url,
      emoji: "🗺️",
      tone: "dark",
      to: "/crawls",
    });

  return (
    <div className="animate-screen pb-4">
      <header className="sticky top-0 z-30 bg-background/95 px-5 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <Link to="/map" className="flex items-center gap-1.5 text-sm font-bold">
            <MapPin className="size-4 text-primary" /> Winnipeg
            <ChevronRight className="size-4 rotate-90 text-muted-foreground" />
          </Link>
          {weather.data && (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">
              {weather.data.feelsLike <= -15
                ? "🥶"
                : weather.data.temp <= 0
                  ? "❄️"
                  : weather.data.temp >= 22
                    ? "☀️"
                    : "🌤️"}{" "}
              {weather.data.temp}°C
            </span>
          )}
        </div>
        <label className="mt-3 flex h-12 items-center gap-3 rounded-full bg-secondary px-4">
          <Search className="size-5 text-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search spots, food, neighbourhoods"
            className="h-full flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search" className="p-1">
              <X className="size-4" />
            </button>
          )}
        </label>
      </header>

      {!searching && (
        <h1 className="px-5 pt-2 text-[1.75rem] font-extrabold leading-[1.1]">
          {name ? `Hey ${name}, what` : "What"} are we <span className="text-primary">biting</span>{" "}
          today?
        </h1>
      )}

      <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto px-5 pb-1">
        {CATEGORIES.map((c) => {
          const active = cat === c.name;
          return (
            <button
              key={c.name}
              onClick={() => setCat(active ? null : c.name)}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5 active:scale-95"
              aria-pressed={active}
            >
              <span
                className={`grid size-16 place-items-center rounded-full text-3xl transition-all ${
                  active ? "bg-primary-soft ring-2 ring-primary" : "bg-secondary"
                }`}
              >
                {c.emoji}
              </span>
              <span className={`text-xs ${active ? "font-extrabold" : "font-semibold"}`}>
                {c.name}
              </span>
            </button>
          );
        })}
      </div>

      {!searching && (
        <>
          <HomeHero slides={slides} />

          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5">
            {HONEST_PROMISES.map((p) => (
              <span
                key={p.text}
                className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold"
              >
                {p.emoji} {p.text}
              </span>
            ))}
          </div>

          {liveUnlocks.length > 0 && (
            <Rail
              title="🔓 Unlock together"
              sub="Big deals that switch on when enough people join"
              to="/drops"
              search={{ tab: "unlock" }}
            >
              {liveUnlocks.map((d) => (
                <UnlockCard key={d.id} deal={d} now={now} />
              ))}
            </Rail>
          )}

          {trendingSpots.length > 0 && (
            <Rail title="📈 Trending this week" sub="Where Winnipeg is eating right now">
              {trendingSpots.map(({ r, t }, n) =>
                r ? (
                  <Link
                    key={r.id}
                    to="/r/$slug"
                    params={{ slug: r.slug }}
                    className="relative flex w-[200px] shrink-0 items-end active:scale-[0.98]"
                  >
                    <span
                      className="absolute -left-1 bottom-6 z-10 select-none font-extrabold leading-none text-background"
                      style={{
                        fontSize: "112px",
                        WebkitTextStroke: "3px var(--foreground)",
                        letterSpacing: "-0.08em",
                      }}
                      aria-hidden
                    >
                      {n + 1}
                    </span>
                    <div className="ml-12 w-full">
                      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted shadow-card">
                        {r.cover_url ? (
                          <img
                            src={r.cover_url}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="grid size-full place-items-center text-5xl">
                            {emojiFor(r.category)}
                          </div>
                        )}
                        {n < 3 && (
                          <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-extrabold text-primary-foreground">
                            🔥 Hot
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-sm font-bold">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.stamps + t.orders} visits · {t.reviews} new{" "}
                        {t.reviews === 1 ? "review" : "reviews"}
                      </p>
                    </div>
                  </Link>
                ) : null,
              )}
            </Rail>
          )}

          <div className="mt-6 px-5">
            <VortexBanner compact />
          </div>

          {(value.data?.length ?? 0) > 0 && (
            <Rail title="💸 Eat well under $15" sub="Honest prices, no tip screen" to="/eats">
              {value.data!.slice(0, 12).map((i) => (
                <ValueCard key={i.id} item={i} fixed />
              ))}
            </Rail>
          )}

          {liveDrops.length > 0 && (
            <Rail title="🔥 Live drops" to="/drops">
              {liveDrops.map((d) => (
                <Link key={d.id} to="/drops" className="w-[240px] shrink-0 active:scale-[0.98]">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
                    {d.photo_url ? (
                      <img
                        src={d.photo_url}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center bg-warm text-5xl">🔥</div>
                    )}
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                      {d.quantity_left} left
                      {d.ends_at ? ` · ${countdown(new Date(d.ends_at).getTime() - now)}` : ""}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-bold">{d.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {d.restaurants?.name} · {formatPrice(d.price_cents)}
                  </p>
                </Link>
              ))}
            </Rail>
          )}

          {rescue.length > 0 && (
            <Rail
              title="♻️ Save food tonight"
              sub="60–70% off food that would be thrown out"
              to="/drops"
              search={{ tab: "leftover" }}
            >
              {rescue.map((d) => {
                const off = d.original_price_cents
                  ? Math.round((1 - d.price_cents / d.original_price_cents) * 100)
                  : 0;
                return (
                  <Link
                    key={d.id}
                    to="/drops"
                    search={{ tab: "leftover" }}
                    className="w-[200px] shrink-0 active:scale-[0.98]"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                      {d.photo_url ? (
                        <img
                          src={d.photo_url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-5xl">♻️</div>
                      )}
                      {off > 0 && (
                        <span className="absolute left-2.5 top-2.5 rounded-full bg-success px-2 py-0.5 text-[11px] font-bold text-success-foreground">
                          {off}% off
                        </span>
                      )}
                    </div>
                    <p className="mt-2 truncate font-bold">{d.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      <span className="font-bold text-foreground">
                        {formatPrice(d.price_cents)}
                      </span>
                      {d.original_price_cents ? (
                        <span className="ml-1 line-through">
                          {formatPrice(d.original_price_cents)}
                        </span>
                      ) : null}
                      {d.ends_at
                        ? ` · by ${clockTime(d.ends_at).split(" ").slice(1).join(" ")}`
                        : ""}
                    </p>
                  </Link>
                );
              })}
            </Rail>
          )}

          {topDishes.length > 0 && (
            <Rail title="🏆 Best in the Peg" sub="Top-rated dish in each category" to="/best">
              {topDishes.map((r) => (
                <Link
                  key={r.menu_item_id}
                  to="/best"
                  search={{ dish: r.dish_type }}
                  className="w-[170px] shrink-0 active:scale-[0.98]"
                >
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                    {r.photo_url ? (
                      <img
                        src={r.photo_url}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-5xl">
                        {dishEmoji(r.dish_type)}
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-card px-2 py-0.5 text-[11px] font-extrabold">
                      🥇 Best {r.dish_type.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-bold">{r.name}</p>
                  <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />{" "}
                    {r.avg_rating.toFixed(1)} · {r.restaurant_name}
                  </p>
                </Link>
              ))}
            </Rail>
          )}

          {twinSpots.length > 0 && (
            <Rail title="💡 Picked for your taste" sub="Loved by people who eat where you eat">
              {twinSpots.map(({ r, n }) =>
                r ? (
                  <div key={r.id} className="shrink-0">
                    <RestaurantCard r={r} x={extras(r)} compact />
                    <p className="mt-0.5 text-xs font-semibold text-primary">
                      {n} taste twins love it
                    </p>
                  </div>
                ) : null,
              )}
            </Rail>
          )}

          {(crawls.data?.length ?? 0) > 0 && (
            <Rail title="🗺️ Food crawls" sub="Hit every stop, earn the reward" to="/crawls">
              {crawls.data?.map((c) => (
                <Link
                  key={c.id}
                  to="/crawls/$slug"
                  params={{ slug: c.slug }}
                  className="relative w-[260px] shrink-0 overflow-hidden rounded-2xl active:scale-[0.98]"
                >
                  <div className="aspect-[16/10] bg-muted">
                    {c.cover_url && (
                      <img
                        src={c.cover_url}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                    <p className="text-lg font-extrabold leading-tight">
                      {c.emoji} {c.title}
                    </p>
                    <p className="text-xs opacity-90">
                      {c.crawl_stops.length} {c.crawl_stops.length === 1 ? "stop" : "stops"}
                      {c.reward ? ` · 🎁 ${c.reward}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </Rail>
          )}

          {specialSpots.length > 0 && (
            <Rail title="⭐ House specials" sub="The dish each spot is proudest of">
              {specialSpots.map((r) => {
                const sp = specials.data?.get(r.id);
                return (
                  <Link
                    key={r.id}
                    to="/r/$slug"
                    params={{ slug: r.slug }}
                    className="w-[170px] shrink-0 active:scale-[0.98]"
                  >
                    <div className="aspect-square overflow-hidden rounded-2xl bg-muted">
                      {sp?.photo_url ? (
                        <img
                          src={sp.photo_url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-5xl">
                          {emojiFor(r.category)}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 truncate font-bold">{sp?.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {r.name}
                      {sp ? ` · ${formatPrice(sp.price_cents)}` : ""}
                    </p>
                  </Link>
                );
              })}
            </Rail>
          )}

          <div className="mt-7 px-5">
            <Link
              to="/for-restaurants"
              className="relative block overflow-hidden rounded-2xl bg-foreground p-5 text-background active:scale-[0.99]"
            >
              <span className="absolute -right-3 -top-4 text-8xl opacity-20">👩‍🍳</span>
              <p className="text-xs font-extrabold uppercase tracking-wider opacity-70">
                For restaurants
              </p>
              <p className="mt-1 text-xl font-extrabold leading-tight">
                Own a spot? Join Bite free for 3 months.
              </p>
              <p className="mt-1 text-sm opacity-80">
                Pickup orders, drops and Save food deals with no fees.
              </p>
              <span className="mt-3 inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground">
                See how it works
              </span>
            </Link>
          </div>

          <div className="mt-4 px-5">
            <Link
              to="/map"
              className="relative block overflow-hidden rounded-2xl bg-secondary p-4 active:scale-[0.99]"
            >
              <p className="text-lg font-extrabold">🗺️ See what's near you</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Ratings, live busyness and wait times on the map
              </p>
              <ChevronRight className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            </Link>
          </div>
        </>
      )}

      <section className="mt-7 px-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-extrabold">{cat ?? (searching ? "Results" : "All spots")}</h2>
          <span className="text-sm text-muted-foreground">
            {list.length} {list.length === 1 ? "spot" : "spots"}
          </span>
        </div>
        <div className="space-y-6">
          {isLoading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="aspect-[16/9] animate-pulse rounded-2xl bg-muted" />
            ))}
          {list.map((r) => (
            <RestaurantCard key={r.id} r={r} x={extras(r)} />
          ))}
          {!isLoading && list.length === 0 && (
            <div className="rounded-2xl bg-secondary p-8 text-center">
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

function Rail({
  title,
  sub,
  to,
  search,
  children,
}: {
  title: string;
  sub?: string;
  to?: "/drops" | "/best" | "/crawls" | "/eats";
  search?: { tab?: "leftover" | "unlock" };
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-end justify-between px-5">
        <div>
          <h2 className="text-xl font-extrabold leading-tight">{title}</h2>
          {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </div>
        {to && (
          <Link
            to={to}
            search={search ?? {}}
            className="grid size-9 place-items-center rounded-full bg-secondary"
            aria-label={`See all ${title}`}
          >
            <ChevronRight className="size-5" />
          </Link>
        )}
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">{children}</div>
    </section>
  );
}
