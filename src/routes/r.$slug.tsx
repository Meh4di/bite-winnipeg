import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Flame, Heart, Lock, MapPin, Megaphone, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DAYS, displayAddress, emojiFor, formatPrice, formatTime, hasHours, openState, winnipegNow, type Hours } from "@/lib/bite";
import { ReportListing, SampleBanner, UnclaimedCard } from "@/components/bite/Listing";
import { OpenBadge } from "@/components/bite/RestaurantCard";
import { useEffect } from "react";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Quantity } from "@/components/bite/Quantity";
import { TabBar } from "@/components/bite/TabBar";
import { clockTime, countdown, dropState, useDrops, useNow, usePromotions } from "@/lib/live";
import { levelName } from "@/lib/passport";
import { liveBusy, useLiveQueue, useRatings } from "@/lib/community";
import { BusyLine, RatingPill } from "@/components/bite/Busy";
import { ReviewsSection } from "@/components/bite/Reviews";
import { DishRate } from "@/components/bite/DishRate";
import { PayForwardCard } from "@/components/bite/PayForward";
import { useDishLeaderboard, useDishRatings } from "@/lib/dishes";

export const Route = createFileRoute("/r/$slug")({
  head: () => ({
    meta: [
      { title: "Restaurant menu — Bity" },
      { name: "description", content: "Menu, hours and location for a Winnipeg spot on Bity." },
      { property: "og:title", content: "Restaurant menu — Bity" },
      { property: "og:description", content: "Menu, hours and location on Bity." },
    ],
  }),
  component: RestaurantPage,
});

function RestaurantPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const cart = useCart();
  useEffect(() => {
    const channel = supabase.channel(`restaurant-orders-${crypto.randomUUID()}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurants", filter: `slug=eq.${slug}` }, () => qc.invalidateQueries({ queryKey: ["restaurant", slug] })).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [slug, qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["restaurant", slug, user?.id ?? "anon"],
    queryFn: async () => {
      const { data: r, error } = await supabase.from("restaurants").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      if (!r) return null;
      const [cats, items] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("restaurant_id", r.id).order("sort_order"),
        supabase.from("menu_items").select("*").eq("restaurant_id", r.id).order("created_at"),
      ]);
      return { r, cats: cats.data ?? [], items: items.data ?? [] };
    },
  });

  const rid = data?.r.id;
  const now = useNow(1000);
  const drops = useDrops(rid);
  const promos = usePromotions(rid);
  const ratings = useRatings();
  const dishRatings = useDishRatings(rid, user?.id);
  const board = useDishLeaderboard();
  const canRate = useQuery({
    queryKey: ["can-review", rid, user?.id],
    enabled: !!user && !!rid,
    queryFn: async () => {
      if (!user || !rid) return false;
      const { count } = await supabase
        .from("stamps")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("restaurant_id", rid);
      return (count ?? 0) > 0;
    },
  });
  const queue = useLiveQueue();
  const teaser = useQuery({
    queryKey: ["secret-teaser", rid, user?.id ?? "anon"],
    enabled: !!rid,
    queryFn: async () => {
      if (!rid) return null;
      const { data, error } = await supabase.rpc("secret_menu_teaser", { p_restaurant_id: rid });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const following = useQuery({
    queryKey: ["following", user?.id, rid],
    enabled: !!user && !!rid,
    queryFn: async () => {
      if (!user || !rid) return false;
      const { data } = await supabase
        .from("follows")
        .select("restaurant_id")
        .eq("user_id", user.id)
        .eq("restaurant_id", rid)
        .maybeSingle();
      return !!data;
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      if (!rid) return;
      if (following.data) {
        const { error } = await supabase.from("follows").delete().eq("user_id", user.id).eq("restaurant_id", rid);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").insert({ user_id: user.id, restaurant_id: rid });
        if (error) throw error;
        toast.success(`Following ${data?.r.name ?? "this spot"} 🧡`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["following"] });
      qc.invalidateQueries({ queryKey: ["follows"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="h-72 animate-pulse bg-muted" />;
  if (!data)
    return (
      <div className="p-10 text-center">
        <p className="text-5xl">🫥</p>
        <p className="mt-3 font-semibold">This spot doesn't exist</p>
        <Link to="/" className="mt-4 inline-block font-semibold text-primary">
          Back home
        </Link>
      </div>
    );

  const { r, cats, items } = data;
  const hours = (r.hours ?? {}) as Hours;
  const open = openState(hours);
  const unclaimed = r.verification_status === "unclaimed";
  const today = winnipegNow().day;
  const groups = [
    ...cats.map((c) => ({ id: c.id, name: c.name, items: items.filter((i) => i.category_id === c.id) })),
    { id: "other", name: "More", items: items.filter((i) => !i.category_id) },
  ].filter((g) => g.items.length);

  return (
    <div className="animate-screen pb-48">
      <div className="relative aspect-[4/3] bg-muted">
        {r.cover_url && <img src={r.cover_url} alt={r.name} className="size-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <button
          onClick={() => (window.history.length > 1 ? router.history.back() : navigate({ to: "/" }))}
          aria-label="Back"
          className="absolute left-4 top-[max(env(safe-area-inset-top),1rem)] grid size-11 place-items-center rounded-full bg-card/90 shadow-card backdrop-blur active:scale-90"
        >
          <ArrowLeft className="size-5" />
        </button>
      </div>

      <div className="relative -mt-14 px-5">
        <div className="flex items-end gap-4">
          {r.logo_url ? (
            <img src={r.logo_url} alt="" className="size-24 rounded-3xl object-cover shadow-card ring-4 ring-background" />
          ) : (
            <div className="grid size-24 place-items-center rounded-3xl bg-primary-soft text-4xl shadow-card ring-4 ring-background">
              {emojiFor(r.category)}
            </div>
          )}
          <div className="pb-1">
            {unclaimed ? (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">Not on Bity yet</span>
            ) : (
              <OpenBadge open={open} />
            )}
          </div>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight">{r.name}</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          {emojiFor(r.category)} {r.category} · {r.neighbourhood}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {!unclaimed && <RatingPill avg={ratings.data?.get(r.id)?.avg ?? 0} count={ratings.data?.get(r.id)?.count ?? 0} />}
          {open && <BusyLine busy={liveBusy(r, now)} queue={queue.data?.get(r.id)} />}
        </div>
        {r.description && <p className="mt-3 text-[15px] leading-relaxed">{r.description}</p>}

        <button
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          className={`mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold transition-all active:scale-[0.98] ${
            following.data ? "bg-primary-soft text-primary" : "bg-primary text-primary-foreground shadow-pop"
          }`}
        >
          <Heart className={`size-5 ${following.data ? "fill-current" : ""}`} />
          {following.data ? "Following" : "Follow"}
        </button>
        {unclaimed && <UnclaimedCard id={r.id} name={r.name} />}
        {r.is_sample && <SampleBanner />}

        <div className="mt-5 space-y-3 rounded-3xl bg-card p-4 shadow-card">
          {r.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(`${displayAddress(r.address)}, MB`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 text-sm"
            >
              <MapPin className="size-5 text-primary" />
              {displayAddress(r.address)}
            </a>
          )}
          {r.phone && (
            <a href={`tel:${r.phone}`} className="flex items-center gap-3 text-sm">
              <Phone className="size-5 text-primary" />
              {r.phone}
            </a>
          )}
          {!hasHours(hours) ? (
            <p className="flex items-center gap-3 text-sm text-muted-foreground">
              <Clock className="size-5 text-primary" /> Hours not listed yet
            </p>
          ) : (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 text-sm">
              <Clock className="size-5 text-primary" />
              <span className="flex-1">
                Today:{" "}
                {hours[today as keyof Hours]?.closed || !hours[today as keyof Hours]?.open
                  ? "Closed"
                  : `${formatTime(hours[today as keyof Hours]?.open)} – ${formatTime(hours[today as keyof Hours]?.close)}`}
              </span>
              <span className="text-xs font-semibold text-primary group-open:hidden">All hours</span>
            </summary>
            <ul className="mt-3 space-y-1.5 pl-8 text-sm">
              {DAYS.map((d) => {
                const h = hours[d.key];
                return (
                  <li key={d.key} className={`flex justify-between ${d.key === today ? "font-bold" : ""}`}>
                    <span>{d.label}</span>
                    <span className="text-muted-foreground">
                      {h?.closed || !h?.open ? "Closed" : `${formatTime(h.open)} – ${formatTime(h.close)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
          )}
        </div>

        {(() => {
          const happening = (drops.data ?? []).filter((d) => ["live", "upcoming"].includes(dropState(d, now)));
          const deals = promos.data ?? [];
          if (!happening.length && !deals.length) return null;
          return (
            <section className="mt-8">
              <h2 className="text-2xl font-extrabold">Happening now</h2>
              <div className="mt-3 space-y-2">
                {happening.map((d) => {
                  const live = dropState(d, now) === "live";
                  return (
                    <Link key={d.id} to="/drops" className="flex items-center gap-3 rounded-2xl bg-primary-soft p-3 active:scale-[0.98]">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                        <Flame className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{d.title}</p>
                        <p className="text-sm text-primary">
                          {live
                            ? `${d.kind === "leftover" ? "Last call" : "Live drop"} · ${d.quantity_left} left${d.ends_at ? ` · ${countdown(new Date(d.ends_at).getTime() - now)}` : ""}`
                            : `Drops ${clockTime(d.starts_at)}`}
                        </p>
                      </div>
                      <span className="font-bold text-primary">{formatPrice(d.price_cents)}</span>
                    </Link>
                  );
                })}
                {deals.map((p) => (
                  <Link key={p.id} to="/drops" className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card active:scale-[0.98]">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                      <Megaphone className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{p.title}</p>
                      {p.promo_code && <p className="font-mono text-sm font-bold text-primary">{p.promo_code}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })()}

        {!unclaimed && <h2 className="mt-8 text-2xl font-extrabold">Menu</h2>}
        {teaser.data && teaser.data.locked_count > 0 && (
          <Link
            to="/passport"
            className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-soft/60 p-4 active:scale-[0.98]"
          >
            <span className="text-3xl">🤫</span>
            <div className="flex-1">
              <p className="font-bold">
                {teaser.data.locked_count} secret {teaser.data.locked_count === 1 ? "item" : "items"} here
              </p>
              <p className="text-sm text-muted-foreground">
                {user ? `Reach ${levelName(teaser.data.next_level)} in your Passport to unlock` : "Sign in and collect stamps to unlock"}
              </p>
            </div>
            <Lock className="size-5 text-primary" />
          </Link>
        )}
        {!r.accepting_orders && !unclaimed && <p className="mt-3 rounded-xl bg-secondary p-4 font-semibold text-muted-foreground">Not taking orders right now</p>}
        {(() => {
          const special = items.find((i) => i.is_house_special && i.is_available);
          if (!special) return null;
          return (
            <div className="mt-4 overflow-hidden rounded-3xl bg-warm text-primary-foreground shadow-pop">
              {special.photo_url && <img src={special.photo_url} alt={special.name} className="aspect-[16/9] w-full object-cover" />}
              <div className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-90">⭐ House special</p>
                  <p className="text-xl font-extrabold leading-tight">{special.name}</p>
                  {special.description && <p className="mt-1 line-clamp-2 text-sm opacity-90">{special.description}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="font-display text-xl font-extrabold">{formatPrice(special.price_cents)}</span>
                  {r.accepting_orders && (
                    <Button
                      variant="secondary"
                      className="h-10 px-4 font-bold text-primary"
                      onClick={() =>
                        cart.add(
                          { id: r.id, name: r.name, slug: r.slug },
                          { id: special.id, name: special.name, price_cents: special.price_cents, photo_url: special.photo_url },
                        )
                      }
                    >
                      Add
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        {groups.length === 0 && !unclaimed && <p className="mt-2 text-muted-foreground">Menu coming soon.</p>}
        {groups.map((g) => (
          <section key={g.id} className="mt-5">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">{g.name}</h3>
            <div className="space-y-3">
              {g.items.map((i) => (
                <div
                  key={i.id}
                  className={`flex gap-3 rounded-2xl bg-card p-3 shadow-card ${i.is_available ? "" : "opacity-50"}`}
                >
                  <div className="min-w-0 flex-1 py-1">
                    {i.is_secret && (
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-background">
                        🤫 Secret menu{i.required_level > 0 ? ` · ${levelName(i.required_level)}+` : ""}
                      </span>
                    )}
                    <p className="font-semibold leading-snug">
                      {i.is_house_special && <span className="mr-1">⭐</span>}
                      {i.name}
                      {i.is_small_plate && (
                        <span className="ml-1.5 rounded-full bg-success/15 px-1.5 py-0.5 align-middle text-[10px] font-extrabold text-success">
                          SMALL PLATE
                        </span>
                      )}
                    </p>
                    {i.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{i.description}</p>
                    )}
                    <DishRate
                      itemId={i.id}
                      restaurantId={r.id}
                      stats={dishRatings.data?.stats.get(i.id)}
                      mine={dishRatings.data?.mine.get(i.id)}
                      rank={board.data?.rank.get(i.id)}
                      dishType={i.dish_type}
                      canRate={!!canRate.data && r.owner_id !== user?.id}
                    />
                    <p className="mt-2 font-bold text-primary">
                      {formatPrice(i.price_cents)}
                      {!i.is_available && <span className="ml-2 text-xs text-muted-foreground">Sold out</span>}
                    </p>
                    {i.is_available && r.accepting_orders && (
                      <div className="mt-3">
                        {cart.cart?.restaurant.id === r.id && cart.cart.items.some(item => item.id === i.id) ? (
                          <Quantity name={i.name} quantity={cart.cart.items.find(item => item.id === i.id)?.quantity ?? 0} onChange={delta => cart.change(i.id, delta)} />
                        ) : <Button variant="secondary" className="h-11 px-5 font-bold text-primary" aria-label={`Add ${i.name}`} onClick={() => cart.add({ id: r.id, name: r.name, slug: r.slug }, { id: i.id, name: i.name, price_cents: i.price_cents, photo_url: i.photo_url })}>Add</Button>}
                      </div>
                    )}
                  </div>
                  {i.photo_url && (
                    <img src={i.photo_url} alt={i.name} loading="lazy" className="size-24 shrink-0 rounded-xl object-cover" />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="px-5">
        {r.pay_it_forward && <PayForwardCard restaurantId={r.id} slug={r.slug} name={r.name} />}
        {!unclaimed && <ReviewsSection restaurantId={r.id} restaurantName={r.name} isOwner={!!user && r.owner_id === user.id} />}
        {!r.is_sample && <ReportListing restaurantId={r.id} />}
      </div>
      {cart.count > 0 && <div className="fixed inset-x-0 bottom-[calc(4rem+max(env(safe-area-inset-bottom),0.5rem))] z-30 mx-auto max-w-[430px] bg-background/95 p-4 backdrop-blur"><Button asChild size="xl" className="w-full"><Link to="/checkout">View cart · {cart.count} {cart.count === 1 ? "item" : "items"} · {formatPrice(cart.total)}</Link></Button></div>}
      <TabBar />
    </div>
  );
}
