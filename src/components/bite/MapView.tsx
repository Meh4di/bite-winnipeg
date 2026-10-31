import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { Check, Flame, LocateFixed, Navigation, Search, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { emojiFor, formatPrice, isOpenNow, openState } from "@/lib/bite";
import { BUSY, liveBusy, type BusyLevel } from "@/lib/community";
import {
  BEST_CATEGORIES,
  logSpotEvent,
  MEDALS,
  useBestSpots,
  useMyVotes,
  type BestKey,
  type Heat,
} from "@/lib/map";
import { BusyLine, RatingPill } from "@/components/bite/Busy";
import { OpenBadge } from "@/components/bite/RestaurantCard";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type MapSpot = {
  id: string;
  slug: string;
  name: string;
  category: string;
  neighbourhood: string | null;
  address: string | null;
  cover_url: string | null;
  lat: number | null;
  lng: number | null;
  hours: unknown;
  busy_level: string | null;
  wait_minutes: number | null;
  busy_updated_at: string | null;
  verification_status?: string;
  is_sample?: boolean;
};

type Extras = {
  ratings: Map<string, { avg: number; count: number }>;
  queue: Map<string, number>;
  specials: Map<string, { name: string; price_cents: number }>;
  deals: Map<string, { drops: number; rescue: number }>;
  heat: Map<string, Heat>;
};

const WINNIPEG: [number, number] = [49.8951, -97.1384];
const FILTERS = [
  { key: "hot", label: "🔥 Hot this week" },
  { key: "open", label: "Open now" },
  { key: "deals", label: "🏷️ Deals" },
  { key: "calm", label: "🟢 Not busy" },
  { key: "top", label: "⭐ 4+" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function pinIcon(spot: MapSpot, x: Extras, selected: boolean, now: number, rank: number | null) {
  const busy = liveBusy(spot, now);
  const open = openState(spot.hours);
  const ring = busy?.level
    ? BUSY[busy.level as BusyLevel].dot
    : open === false
      ? "#9ca3af"
      : "#ffffff";
  const rating = x.ratings.get(spot.id);
  const deal = x.deals.get(spot.id);
  const heat = x.heat.get(spot.id)?.level ?? 0;
  const glow =
    heat >= 0.15
      ? ` is-hot" style="--ring:${ring};--heat:${(0.35 + heat * 0.65).toFixed(2)}`
      : `" style="--ring:${ring}`;
  const label =
    rank !== null
      ? `<span class="bite-pin-rating">${MEDALS[rank] ?? `#${rank + 1}`}</span>`
      : rating?.count
        ? `<span class="bite-pin-rating">★ ${rating.avg.toFixed(1)}</span>`
        : "";
  const html = `
    <div class="bite-pin${selected ? " is-selected" : ""}${open === false ? " is-closed" : ""}${glow}">
      <span class="bite-pin-emoji">${emojiFor(spot.category)}</span>
      ${label}
      ${deal && (deal.drops || deal.rescue) ? `<span class="bite-pin-deal">${deal.rescue ? "♻️" : "🔥"}</span>` : ""}
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [48, 48], iconAnchor: [24, 44] });
}

function FlyTo({ to }: { to: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (to) map.flyTo(to, Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [to, map]);
  return null;
}

export default function MapView({
  spots,
  extras,
  now,
}: {
  spots: MapSpot[];
  extras: Extras;
  now: number;
}) {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [layer, setLayer] = useState<BestKey | null>(null);
  const [voting, setVoting] = useState(false);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

  const best = useBestSpots(layer);
  const myVotes = useMyVotes(user?.id);
  const rankOf = useMemo(
    () => new Map((best.data ?? []).map((b, i) => [b.restaurant_id, i])),
    [best.data],
  );
  const byId = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);
  const layerInfo = BEST_CATEGORIES.find((c) => c.key === layer);

  const visible = useMemo(
    () =>
      spots.filter((s) => {
        if (s.lat === null || s.lng === null) return false;
        if (layer) return rankOf.has(s.id);
        const busy = liveBusy(s, now);
        const deal = extras.deals.get(s.id);
        if (filters.has("hot") && (extras.heat.get(s.id)?.level ?? 0) < 0.15) return false;
        if (filters.has("open") && !isOpenNow(s.hours)) return false;
        if (filters.has("deals") && !(deal && (deal.drops || deal.rescue))) return false;
        if (filters.has("calm") && busy?.level && !["quiet", "steady"].includes(busy.level))
          return false;
        if (filters.has("top") && (extras.ratings.get(s.id)?.avg ?? 0) < 4) return false;
        return true;
      }),
    [spots, filters, extras, now, layer, rankOf],
  );
  const selected = visible.find((s) => s.id === selectedId) ?? null;
  const missing = spots.filter((s) => s.lat === null || s.lng === null).length;

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setMe(p);
        setFlyTo(p);
      },
      () => toast.error("Allow location access to see spots near you"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const toggle = (k: FilterKey) =>
    setFilters((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const select = (s: MapSpot) => {
    setSelectedId(s.id);
    if (s.lat !== null && s.lng !== null) setFlyTo([s.lat, s.lng]);
  };

  return (
    <div className="relative isolate h-[calc(100dvh-4rem-max(env(safe-area-inset-bottom),0.5rem))] w-full">
      <MapContainer
        center={WINNIPEG}
        zoom={13}
        zoomControl={false}
        className="size-full"
        attributionControl
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <FlyTo to={flyTo} />
        {me && (
          <CircleMarker
            center={me}
            radius={8}
            pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
          />
        )}
        {visible.map((s) => (
          <Marker
            key={`${s.id}-${layer ?? "all"}`}
            position={[s.lat as number, s.lng as number]}
            icon={pinIcon(
              s,
              extras,
              s.id === selectedId,
              now,
              layer ? (rankOf.get(s.id) ?? null) : null,
            )}
            eventHandlers={{ click: () => select(s) }}
            keyboard
            title={s.name}
          />
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] space-y-2 p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="no-scrollbar pointer-events-auto flex gap-2 overflow-x-auto">
          <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-sm font-extrabold text-background shadow-card">
            <Trophy className="size-4" /> Best in the Peg
          </span>
          {BEST_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => {
                setSelectedId(null);
                setLayer(layer === c.key ? null : c.key);
              }}
              aria-pressed={layer === c.key}
              className={`h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold shadow-card ${
                layer === c.key ? "bg-primary text-primary-foreground" : "bg-card"
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        {!layer && (
          <div className="no-scrollbar pointer-events-auto flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => toggle(f.key)}
                aria-pressed={filters.has(f.key)}
                className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold shadow-card ${
                  filters.has(f.key) ? "bg-foreground text-background" : "bg-card/95"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        {!layer && (
          <p className="pointer-events-auto inline-block rounded-full bg-card/90 px-3 py-1 text-xs font-semibold shadow-card backdrop-blur">
            {visible.length} {visible.length === 1 ? "spot" : "spots"}
            {missing > 0 && !filters.size ? ` · ${missing} not on the map yet` : ""}
          </p>
        )}
      </div>

      <button
        onClick={locate}
        aria-label="Show spots near me"
        className="absolute right-3 z-[1000] grid size-12 place-items-center rounded-full bg-card shadow-pop active:scale-90"
        style={{ bottom: selected ? "15.5rem" : layer ? "17rem" : "1rem" }}
      >
        <LocateFixed className="size-5 text-primary" />
      </button>

      {layer && !selected && layerInfo && (
        <div className="absolute inset-x-3 bottom-3 z-[1100] rounded-3xl bg-card p-4 shadow-pop animate-screen">
          <div className="flex items-center justify-between gap-2">
            <p className="text-lg font-extrabold leading-tight">
              {layerInfo.emoji} Best {layerInfo.label.toLowerCase()} in Winnipeg
            </p>
            <Button size="sm" className="shrink-0 rounded-full" onClick={() => setVoting(true)}>
              {myVotes.data?.get(layer) ? "Change vote" : "Vote"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Voted by locals. Votes from people who've been there count double.
          </p>
          <ol className="mt-2 max-h-36 space-y-1 overflow-y-auto">
            {(best.data ?? []).slice(0, 5).map((b, i) => {
              const s = byId.get(b.restaurant_id);
              if (!s) return null;
              return (
                <li key={b.restaurant_id}>
                  <button
                    onClick={() => select(s)}
                    className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left active:bg-secondary"
                  >
                    <span className="w-6 text-center">{MEDALS[i] ?? `${i + 1}.`}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{s.name}</span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {b.votes} {b.votes === 1 ? "vote" : "votes"}
                      {b.verified ? ` · ${b.verified} ✓` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
            {!best.isLoading && !best.data?.length && (
              <li className="py-3 text-center text-sm text-muted-foreground">
                No votes yet. Be the first to pick Winnipeg's best!
              </li>
            )}
          </ol>
        </div>
      )}

      {selected && (
        <div className="absolute inset-x-3 bottom-3 z-[1100] overflow-hidden rounded-3xl bg-card shadow-pop animate-screen">
          <button
            onClick={() => setSelectedId(null)}
            aria-label="Close"
            className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full bg-card/90 shadow-card"
          >
            <X className="size-4" />
          </button>
          <div className="flex gap-3 p-3">
            {selected.cover_url ? (
              <img
                src={selected.cover_url}
                alt=""
                className="size-24 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <div className="grid size-24 shrink-0 place-items-center rounded-2xl bg-primary-soft text-4xl">
                {emojiFor(selected.category)}
              </div>
            )}
            <div className="min-w-0 flex-1 pr-8">
              <p className="truncate text-lg font-extrabold leading-tight">{selected.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {emojiFor(selected.category)} {selected.category} · {selected.neighbourhood}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {selected.verification_status === "unclaimed" ? (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold">
                    Not on Bity yet
                  </span>
                ) : (
                  <OpenBadge open={openState(selected.hours)} />
                )}
                <RatingPill
                  avg={extras.ratings.get(selected.id)?.avg ?? 0}
                  count={extras.ratings.get(selected.id)?.count ?? 0}
                />
              </div>
              {isOpenNow(selected.hours) && (
                <div className="mt-1.5">
                  <BusyLine
                    busy={liveBusy(selected, now)}
                    queue={extras.queue.get(selected.id)}
                    compact
                  />
                </div>
              )}
            </div>
          </div>
          <SpotFacts
            spot={selected}
            extras={extras}
            layerLabel={layerInfo?.label}
            rank={rankOf.get(selected.id)}
          />
          <div className="grid grid-cols-2 gap-2 p-3">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => logSpotEvent(selected.id, "directions")}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-secondary text-sm font-bold"
            >
              <Navigation className="size-4" /> Directions
            </a>
            <Link
              to="/r/$slug"
              params={{ slug: selected.slug }}
              className="flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground"
            >
              View spot
            </Link>
          </div>
        </div>
      )}

      {layer && layerInfo && (
        <VoteSheet
          open={voting}
          onOpenChange={setVoting}
          category={layerInfo}
          spots={spots}
          current={myVotes.data?.get(layer) ?? null}
        />
      )}
    </div>
  );
}

function SpotFacts({
  spot,
  extras,
  layerLabel,
  rank,
}: {
  spot: MapSpot;
  extras: Extras;
  layerLabel: string | undefined;
  rank: number | undefined;
}) {
  const h = extras.heat.get(spot.id);
  const special = extras.specials.get(spot.id);
  const deal = extras.deals.get(spot.id);
  const lines: React.ReactNode[] = [];
  if (layerLabel && rank !== undefined)
    lines.push(
      <p key="rank" className="font-bold text-primary">
        {MEDALS[rank] ?? `#${rank + 1}`} for {layerLabel.toLowerCase()} in Winnipeg
      </p>,
    );
  if (h && (h.visits_week > 0 || h.level >= 0.15))
    lines.push(
      <p key="heat" className="flex items-center gap-1 font-semibold text-orange-600">
        <Flame className="size-4" />
        {h.visits_week > 0 ? `${h.visits_week} visits this week` : "Popular this week"}
      </p>,
    );
  if (h?.hot_item)
    lines.push(
      <p key="hot" className="truncate">
        🔥 <b>Selling fast:</b> {h.hot_item}
      </p>,
    );
  if (special)
    lines.push(
      <p key="special" className="truncate">
        ⭐ <b>House special:</b> {special.name} · {formatPrice(special.price_cents)}
      </p>,
    );
  if (h && h.reviews > 0)
    lines.push(
      <p key="reviews" className="text-muted-foreground">
        💬 {h.reviews} {h.reviews === 1 ? "review" : "reviews"}
      </p>,
    );
  if (deal && deal.drops + deal.rescue > 0)
    lines.push(
      <Link key="deal" to="/drops" className="flex items-center gap-1 font-semibold text-primary">
        <Flame className="size-4" />
        {[
          deal.drops ? `${deal.drops} live drop` : "",
          deal.rescue ? `${deal.rescue} food to save` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </Link>,
    );
  if (!lines.length) return null;
  return <div className="space-y-1 px-3 text-sm">{lines}</div>;
}

function VoteSheet({
  open,
  onOpenChange,
  category,
  spots,
  current,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: (typeof BEST_CATEGORIES)[number];
  spots: MapSpot[];
  current: string | null;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const match = new Set<string>(category.match);
    return spots
      .filter((x) => !x.is_sample)
      .filter(
        (x) =>
          !s || [x.name, x.neighbourhood, x.category].some((v) => v?.toLowerCase().includes(s)),
      )
      .sort(
        (a, b) =>
          Number(match.has(b.category)) - Number(match.has(a.category)) ||
          a.name.localeCompare(b.name),
      );
  }, [spots, q, category]);

  const vote = async (id: string) => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setBusy(id);
    const { error } = await supabase.rpc("vote_spot", {
      p_category: category.key,
      p_restaurant_id: id,
    });
    setBusy(null);
    if (error) return void toast.error(error.message);
    toast.success("Vote counted! 🗳️");
    qc.invalidateQueries({ queryKey: ["my-votes"] });
    qc.invalidateQueries({ queryKey: ["best-spots", category.key] });
    qc.invalidateQueries({ queryKey: ["map-heat"] });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[1200] mx-auto max-h-[85dvh] max-w-[430px] overflow-hidden rounded-t-3xl p-0"
      >
        <SheetHeader className="px-5 pt-5 text-left">
          <SheetTitle className="text-2xl font-extrabold">
            {category.emoji} Best {category.label.toLowerCase()}?
          </SheetTitle>
          <SheetDescription>
            Pick your favourite in Winnipeg. One vote per category, and you can change it anytime.
          </SheetDescription>
        </SheetHeader>
        <div className="px-5 pt-3">
          <label className="flex h-11 items-center gap-2 rounded-2xl bg-secondary px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              className="flex-1 bg-transparent text-base outline-none"
              placeholder="Search spots"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
        <ul className="max-h-[55dvh] overflow-y-auto px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
          {list.map((s) => (
            <li key={s.id}>
              <button
                disabled={busy !== null}
                onClick={() => vote(s.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-secondary ${
                  current === s.id ? "bg-primary-soft" : ""
                }`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-xl">
                  {emojiFor(s.category)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.category} · {s.neighbourhood}
                  </span>
                </span>
                {current === s.id && <Check className="size-5 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
