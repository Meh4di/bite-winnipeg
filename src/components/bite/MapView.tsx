import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import { MapBasemap } from "@/components/bite/MapBasemap";
import { useWinnipegWeather } from "@/lib/weather";
import {
  Check,
  ChevronDown,
  Flame,
  List,
  LocateFixed,
  Navigation,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, emojiFor, formatPrice, isOpenNow, openState } from "@/lib/bite";
import { useFeed, usePeople } from "@/lib/social";
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
import { categoryOf, isOnNow, km, useEvents, whenLabel, type BityEvent } from "@/lib/events";
import { FriendsGoing } from "@/components/bite/EventCard";
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
  logo_url?: string | null;
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
  { key: "friends", label: "👯 Friends went" },
] as const;

type FriendsHere = { names: string[]; avatars: (string | null)[]; latest: string };
const esc = (u: string) => u.replace(/["'<>]/g, (c) => encodeURIComponent(c));
const html = (t: string) =>
  t.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
type FilterKey = (typeof FILTERS)[number]["key"];

function pinIcon(
  spot: MapSpot,
  x: Extras,
  selected: boolean,
  now: number,
  rank: number | null,
  friends?: FriendsHere,
) {
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
  const photo = spot.logo_url ?? spot.cover_url;
  const unclaimed = spot.verification_status === "unclaimed";
  const face =
    photo && !unclaimed
      ? `<img class="bite-pin-photo" src="${esc(photo)}" alt="" />`
      : `<span class="bite-pin-emoji">${emojiFor(spot.category)}</span>`;
  const pals = friends
    ? `<span class="bite-pin-friends">${friends.avatars
        .slice(0, 2)
        .map((a, i) =>
          a ? `<img src="${esc(a)}" alt="" />` : `<i>${(friends.names[i] ?? "?")[0]}</i>`,
        )
        .join("")}${friends.names.length > 2 ? `<b>+${friends.names.length - 2}</b>` : ""}</span>`
    : "";
  const hot = heat >= 0.15;
  const badge =
    deal && (deal.drops || deal.rescue)
      ? `<span class="bp-deal">${deal.rescue ? "♻️" : "🔥"}</span>`
      : "";
  const markup = `
    <div class="bp${selected ? " is-selected" : ""}${open === false ? " is-closed" : ""}${unclaimed ? " is-unclaimed" : ""}${hot ? " is-hot" : ""}" style="--ring:${ring};--heat:${(0.35 + heat * 0.65).toFixed(2)}">
      <div class="bp-face">${face.replace("bite-pin-photo", "bp-photo").replace("bite-pin-emoji", "bp-emoji")}</div>
      ${unclaimed ? "" : '<span class="bp-tip"></span>'}
      ${label.replace("bite-pin-rating", "bp-chip")}
      ${badge}
      ${pals.replace("bite-pin-friends", "bp-friends")}
      <span class="bp-name">${html(spot.name)}</span>
    </div>`;
  void glow;
  return unclaimed
    ? L.divIcon({ html: markup, className: "", iconSize: [30, 30], iconAnchor: [15, 15] })
    : L.divIcon({ html: markup, className: "", iconSize: [52, 60], iconAnchor: [26, 58] });
}

function eventIcon(e: BityEvent, selected: boolean) {
  const live = isOnNow(e);
  const friends = e.stats.friends_going;
  const html = `
    <div class="bity-event-pin${selected ? " is-selected" : ""}${live ? " is-live" : ""}">
      <span>${categoryOf(e.category).emoji}</span>
      ${friends > 0 ? `<b>👯 ${friends}</b>` : ""}
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [44, 44], iconAnchor: [22, 40] });
}

function CenterTracker({ onMove }: { onMove: (c: [number, number], zoom: number) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onMove([c.lat, c.lng], e.target.getZoom());
    },
  });
  return null;
}

type Cluster = { key: string; lat: number; lng: number; spots: MapSpot[] };

/** Groups the quiet grey "not on Bity yet" pins into bubbles when zoomed out; Bity spots stay. */
function clusterSpots(spots: MapSpot[], zoom: number, keep: (s: MapSpot) => boolean) {
  if (zoom >= 15) return { singles: spots, clusters: [] as Cluster[] };
  const cell = (360 / (256 * 2 ** zoom)) * 70; // ~70 px cells
  const cells = new Map<string, MapSpot[]>();
  const singles: MapSpot[] = [];
  for (const s of spots) {
    if (keep(s)) {
      singles.push(s);
      continue;
    }
    const k = `${Math.floor(s.lng! / cell)}:${Math.floor(s.lat! / (cell * 0.64))}`;
    cells.set(k, [...(cells.get(k) ?? []), s]);
  }
  const clusters: Cluster[] = [];
  for (const [key, list] of cells) {
    if (list.length < 2) {
      singles.push(...list);
      continue;
    }
    clusters.push({
      key,
      spots: list,
      lat: list.reduce((a, s) => a + s.lat!, 0) / list.length,
      lng: list.reduce((a, s) => a + s.lng!, 0) / list.length,
    });
  }
  return { singles, clusters };
}

function clusterIcon(c: Cluster) {
  const emojis = [...new Set(c.spots.map((s) => emojiFor(s.category)))].slice(0, 2).join("");
  const size = c.spots.length >= 10 ? 58 : c.spots.length >= 5 ? 52 : 46;
  return L.divIcon({
    html: `<div class="bp-cluster" style="width:${size}px;height:${size}px"><span>${emojis}</span><b>${c.spots.length}</b></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const ME_ICON = L.divIcon({
  html: '<div class="bp-me"><span></span></div>',
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FlyTo({ to }: { to: [number, number] | [number, number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (to) map.flyTo([to[0], to[1]], to[2] ?? Math.max(map.getZoom(), 15), { duration: 0.6 });
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
  const [flyTo, setFlyTo] = useState<[number, number] | [number, number, number] | null>(null);
  const [zoom, setZoom] = useState(13);
  const [raster, setRaster] = useState(false);
  const weather = useWinnipegWeather();
  const [showEvents, setShowEvents] = useState(true);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [bestOpen, setBestOpen] = useState(false);
  const [center, setCenter] = useState<[number, number]>(WINNIPEG);

  // Friends' recent spots (last 7 days). The feed only ever contains friends' activity older than
  // an hour (database rule), so this never shows live location or strangers.
  const feed = useFeed(user?.id);
  const recent = useMemo(
    () =>
      (feed.data ?? []).filter(
        (a) =>
          a.restaurant_id &&
          a.user_id !== user?.id &&
          Date.now() - new Date(a.created_at).getTime() < 7 * 86_400_000,
      ),
    [feed.data, user?.id],
  );
  const people = usePeople([...new Set(recent.map((a) => a.user_id))]);
  const friendsAt = useMemo(() => {
    const byId = people.data ?? new Map();
    const m = new Map<string, FriendsHere & { ids: Set<string> }>();
    for (const a of recent) {
      const cur = m.get(a.restaurant_id!) ?? {
        names: [],
        avatars: [],
        latest: a.created_at,
        ids: new Set(),
      };
      if (!cur.ids.has(a.user_id)) {
        cur.ids.add(a.user_id);
        const p = byId.get(a.user_id);
        cur.names.push(p?.full_name?.split(" ")[0] || p?.username || "A friend");
        cur.avatars.push(p?.avatar_url ?? null);
      }
      if (a.created_at > cur.latest) cur.latest = a.created_at;
      m.set(a.restaurant_id!, cur);
    }
    return m;
  }, [recent, people.data]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return spots
      .filter((s) =>
        [s.name, s.category, s.neighbourhood].some((v) => v?.toLowerCase().includes(q)),
      )
      .sort((a, b) => Number(a.lat === null) - Number(b.lat === null))
      .slice(0, 6);
  }, [query, spots]);
  const [eventId, setEventId] = useState<string | null>(null);
  const eventsQ = useEvents();
  const mapEvents = useMemo(
    () =>
      (eventsQ.data ?? []).filter(
        (e) =>
          e.lat !== null &&
          e.lng !== null &&
          new Date(e.starts_at).getTime() < now + 7 * 86_400_000,
      ),
    [eventsQ.data, now],
  );
  const selectedEvent = showEvents ? (mapEvents.find((e) => e.id === eventId) ?? null) : null;

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
        if (cat && s.category !== cat) return false;
        if (filters.has("friends") && !friendsAt.has(s.id)) return false;
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
    [spots, filters, extras, now, layer, rankOf, cat, friendsAt],
  );
  const grouped = useMemo(
    () =>
      clusterSpots(
        visible,
        layer ? 20 : zoom,
        (s) => s.verification_status !== "unclaimed" || s.id === selectedId || friendsAt.has(s.id),
      ),
    [visible, zoom, layer, selectedId, friendsAt],
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
    setEventId(null);
    setSelectedId(s.id);
    if (s.lat !== null && s.lng !== null) setFlyTo([s.lat, s.lng]);
  };

  return (
    <div
      className={`relative isolate h-[calc(100dvh-4rem-max(env(safe-area-inset-bottom),0.5rem))] w-full ${raster ? "is-raster" : ""} ${zoom >= 15 ? "z-near" : ""}`}
    >
      <MapContainer
        center={WINNIPEG}
        zoom={13}
        zoomControl={false}
        className="bity-map size-full"
        attributionControl
      >
        <MapBasemap onRaster={setRaster} />
        <FlyTo to={flyTo} />
        <CenterTracker
          onMove={(c, z) => {
            setCenter(c);
            setZoom(z);
          }}
        />
        {me && <Marker position={me} icon={ME_ICON} interactive={false} zIndexOffset={900} />}
        {grouped.clusters.map((c) => (
          <Marker
            key={`cl-${c.key}-${c.spots.length}`}
            position={[c.lat, c.lng]}
            icon={clusterIcon(c)}
            eventHandlers={{ click: () => setFlyTo([c.lat, c.lng, Math.min(zoom + 2, 16)]) }}
            title={`${c.spots.length} spots`}
          />
        ))}
        {grouped.singles.map((s) => (
          <Marker
            key={`${s.id}-${layer ?? "all"}`}
            position={[s.lat as number, s.lng as number]}
            icon={pinIcon(
              s,
              extras,
              s.id === selectedId,
              now,
              layer ? (rankOf.get(s.id) ?? null) : null,
              friendsAt.get(s.id),
            )}
            eventHandlers={{ click: () => select(s) }}
            keyboard
            title={s.name}
          />
        ))}
        {showEvents &&
          !layer &&
          mapEvents.map((e) => (
            <Marker
              key={`ev-${e.id}`}
              position={[e.lat as number, e.lng as number]}
              icon={eventIcon(e, e.id === eventId)}
              zIndexOffset={500}
              eventHandlers={{
                click: () => {
                  setSelectedId(null);
                  setEventId(e.id);
                  setFlyTo([e.lat as number, e.lng as number]);
                },
              }}
              keyboard
              title={e.title}
            />
          ))}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[999] h-44 bg-gradient-to-b from-background/80 via-background/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] space-y-2 p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="pointer-events-auto relative">
          <label className="flex h-12 items-center gap-2 rounded-full border border-white/50 bg-card/85 px-4 shadow-pop backdrop-blur-xl">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search spots, food, neighbourhoods"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              aria-label="Search the map"
            />
            {query ? (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <X className="size-4 text-muted-foreground" />
              </button>
            ) : (
              weather.data && (
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-extrabold">
                  {weather.data.temp > 0 ? "☀️" : "❄️"} {weather.data.temp}°
                </span>
              )
            )}
          </label>
          {matches.length > 0 && (
            <ul className="absolute inset-x-0 top-14 overflow-hidden rounded-3xl bg-card shadow-pop">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => {
                      setQuery("");
                      setLayer(null);
                      setCat(null);
                      setFilters(new Set());
                      if (m.lat !== null) select(m);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-secondary"
                  >
                    <span className="text-xl">{emojiFor(m.category)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{m.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.category} · {m.neighbourhood}
                        {m.lat === null ? " · not on the map yet" : ""}
                      </span>
                    </span>
                    {m.lat === null && (
                      <Link
                        to="/r/$slug"
                        params={{ slug: m.slug }}
                        className="text-xs font-bold text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </Link>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="no-scrollbar pointer-events-auto flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => {
              setLayer(null);
              setEventId(null);
              setShowEvents(!showEvents);
            }}
            aria-pressed={showEvents}
            className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold shadow-card backdrop-blur-md ${showEvents && !layer ? "bg-violet-600 text-white" : "bg-card"}`}
          >
            📅 What's on{mapEvents.length ? ` · ${mapEvents.length}` : ""}
          </button>
          <button
            onClick={() => (layer ? setLayer(null) : setBestOpen(true))}
            aria-pressed={!!layer}
            className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold shadow-card flex items-center gap-1 ${layer ? "bg-primary text-primary-foreground" : "bg-foreground text-background"}`}
          >
            <Trophy className="size-4" />
            {layerInfo ? `Best ${layerInfo.label.toLowerCase()}` : "Best in the Peg"}
            {layer ? <X className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          {!layer &&
            FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => toggle(f.key)}
                aria-pressed={filters.has(f.key)}
                className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold shadow-card ${filters.has(f.key) ? "bg-foreground text-background" : "bg-card/80 backdrop-blur-md"}`}
              >
                {f.label}
              </button>
            ))}
        </div>

        {!layer && (
          <div className="no-scrollbar pointer-events-auto flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.name}
                onClick={() => setCat(cat === c.name ? null : c.name)}
                aria-pressed={cat === c.name}
                className={`h-8 shrink-0 rounded-full border px-3 text-xs font-bold shadow-card ${
                  cat === c.name
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-white/40 bg-card/75 backdrop-blur-md"
                }`}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selected && !selectedEvent && !layer && (
        <button
          onClick={() => setListOpen(true)}
          className="absolute bottom-4 left-1/2 z-[1000] flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-extrabold text-background shadow-pop active:scale-95"
        >
          <List className="size-4" /> List · {visible.length}{" "}
          {visible.length === 1 ? "spot" : "spots"}
        </button>
      )}

      <button
        onClick={locate}
        aria-label="Show spots near me"
        className="absolute right-3 z-[1000] grid size-12 place-items-center rounded-full bg-card shadow-pop active:scale-90"
        style={{
          bottom: selected ? "15.5rem" : layer ? "17rem" : selectedEvent ? "12.5rem" : "1rem",
        }}
      >
        <LocateFixed className="size-5 text-primary" />
      </button>

      {selectedEvent && !selected && !layer && (
        <div className="absolute inset-x-3 bottom-3 z-[1100] rounded-3xl bg-card p-4 shadow-pop animate-screen">
          <button
            onClick={() => setEventId(null)}
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-secondary"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
          <p className="text-[11px] font-bold uppercase tracking-wide text-violet-600">
            {categoryOf(selectedEvent.category).emoji} {whenLabel(selectedEvent)}
          </p>
          <p className="mt-0.5 pr-8 text-lg font-extrabold leading-tight">{selectedEvent.title}</p>
          <p className="truncate text-sm text-muted-foreground">{selectedEvent.venue_name}</p>
          <FriendsGoing e={selectedEvent} className="mt-1 text-sm" />
          <Button asChild className="mt-3 w-full rounded-full">
            <Link to="/events/$id" params={{ id: selectedEvent.id }}>
              See event
              {selectedEvent.stats.deals
                ? ` & ${selectedEvent.stats.deals} food deals`
                : " & food nearby"}
            </Link>
          </Button>
        </div>
      )}

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
              {friendsAt.get(selected.id) && (
                <p className="mt-1 truncate text-xs font-bold text-primary">
                  👯 {friendsAt.get(selected.id)!.names.slice(0, 2).join(" & ")}
                  {friendsAt.get(selected.id)!.names.length > 2
                    ? ` +${friendsAt.get(selected.id)!.names.length - 2}`
                    : ""}{" "}
                  went {ago(friendsAt.get(selected.id)!.latest)}
                </p>
              )}
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

      <Sheet open={bestOpen} onOpenChange={setBestOpen}>
        <SheetContent side="bottom" className="z-[1200] mx-auto max-w-[430px] rounded-t-3xl p-5">
          <SheetHeader className="p-0 text-left">
            <SheetTitle className="text-2xl font-extrabold">🏆 Best in the Peg</SheetTitle>
            <SheetDescription>
              Winnipeg's favourites, voted by locals. Pick a category.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-2 pb-[env(safe-area-inset-bottom)]">
            {BEST_CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  setSelectedId(null);
                  setEventId(null);
                  setLayer(c.key);
                  setBestOpen(false);
                }}
                className="flex flex-col items-center gap-1 rounded-2xl bg-secondary p-3 text-sm font-bold active:scale-95"
              >
                <span className="text-3xl">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent
          side="bottom"
          className="z-[1200] mx-auto max-h-[80dvh] max-w-[430px] overflow-hidden rounded-t-3xl p-0"
        >
          <SheetHeader className="px-5 pt-5 text-left">
            <SheetTitle className="text-2xl font-extrabold">
              {cat ? `${CATEGORIES.find((c) => c.name === cat)?.emoji} ${cat}` : "Spots"}{" "}
              {me ? "near you" : "on the map"}
            </SheetTitle>
            <SheetDescription>
              {me
                ? "Closest first."
                : "Closest to the middle of the map first. Tap 📍 to use your location."}
            </SheetDescription>
          </SheetHeader>
          <ul className="max-h-[62dvh] space-y-1 overflow-y-auto px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
            {[...visible]
              .map((s) => ({ s, d: km((me ?? center)[0], (me ?? center)[1], s.lat!, s.lng!) }))
              .sort((a, b) => a.d - b.d)
              .map(({ s, d }) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setListOpen(false);
                      select(s);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl p-2 text-left active:bg-secondary"
                  >
                    {s.logo_url || s.cover_url ? (
                      <img
                        src={(s.logo_url ?? s.cover_url)!}
                        alt=""
                        className="size-12 shrink-0 rounded-2xl object-cover"
                      />
                    ) : (
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-2xl">
                        {emojiFor(s.category)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.category} · {s.neighbourhood}
                        {s.verification_status === "unclaimed" ? " · not on Bity yet" : ""}
                      </span>
                      {friendsAt.get(s.id) && (
                        <span className="block truncate text-xs font-bold text-primary">
                          👯 {friendsAt.get(s.id)!.names[0]} went {ago(friendsAt.get(s.id)!.latest)}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs font-bold text-muted-foreground">
                      {d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`}
                    </span>
                  </button>
                </li>
              ))}
            {visible.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">
                Nothing matches. Try removing a filter.
              </li>
            )}
          </ul>
        </SheetContent>
      </Sheet>

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
