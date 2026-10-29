import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { Flame, LocateFixed, Navigation, X } from "lucide-react";
import { toast } from "sonner";
import { emojiFor, formatPrice, isOpenNow } from "@/lib/bite";
import { BUSY, liveBusy, type BusyLevel } from "@/lib/community";
import { BusyLine, RatingPill } from "@/components/bite/Busy";
import { OpenBadge } from "@/components/bite/RestaurantCard";

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
};

type Extras = {
  ratings: Map<string, { avg: number; count: number }>;
  queue: Map<string, number>;
  specials: Map<string, { name: string; price_cents: number }>;
  deals: Map<string, { drops: number; rescue: number }>;
};

const WINNIPEG: [number, number] = [49.8951, -97.1384];
const FILTERS = [
  { key: "open", label: "Open now" },
  { key: "deals", label: "🔥 Deals" },
  { key: "calm", label: "🟢 Not busy" },
  { key: "top", label: "⭐ 4+" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function pinIcon(spot: MapSpot, x: Extras, selected: boolean, now: number) {
  const busy = liveBusy(spot, now);
  const ring = busy?.level
    ? BUSY[busy.level as BusyLevel].dot
    : isOpenNow(spot.hours)
      ? "#ffffff"
      : "#9ca3af";
  const rating = x.ratings.get(spot.id);
  const deal = x.deals.get(spot.id);
  const html = `
    <div class="bite-pin${selected ? " is-selected" : ""}${isOpenNow(spot.hours) ? "" : " is-closed"}" style="--ring:${ring}">
      <span class="bite-pin-emoji">${emojiFor(spot.category)}</span>
      ${rating?.count ? `<span class="bite-pin-rating">★ ${rating.avg.toFixed(1)}</span>` : ""}
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [me, setMe] = useState<[number, number] | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

  const visible = useMemo(
    () =>
      spots.filter((s) => {
        if (s.lat === null || s.lng === null) return false;
        const busy = liveBusy(s, now);
        const deal = extras.deals.get(s.id);
        if (filters.has("open") && !isOpenNow(s.hours)) return false;
        if (filters.has("deals") && !(deal && (deal.drops || deal.rescue))) return false;
        if (filters.has("calm") && busy?.level && !["quiet", "steady"].includes(busy.level))
          return false;
        if (filters.has("top") && (extras.ratings.get(s.id)?.avg ?? 0) < 4) return false;
        return true;
      }),
    [spots, filters, extras, now],
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

  return (
    <div className="relative h-[calc(100dvh-4rem-max(env(safe-area-inset-bottom),0.5rem))] w-full">
      <MapContainer
        center={WINNIPEG}
        zoom={13}
        zoomControl={false}
        className="size-full"
        attributionControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
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
            key={s.id}
            position={[s.lat as number, s.lng as number]}
            icon={pinIcon(s, extras, s.id === selectedId, now)}
            eventHandlers={{
              click: () => {
                setSelectedId(s.id);
                setFlyTo([s.lat as number, s.lng as number]);
              },
            }}
            keyboard
            title={s.name}
          />
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="no-scrollbar pointer-events-auto flex gap-2 overflow-x-auto">
          <Link
            to="/"
            className="flex h-10 shrink-0 items-center rounded-full bg-card px-4 text-sm font-bold shadow-card"
          >
            ☰ List
          </Link>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => toggle(f.key)}
              aria-pressed={filters.has(f.key)}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold shadow-card ${
                filters.has(f.key) ? "bg-primary text-primary-foreground" : "bg-card"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="pointer-events-auto mt-2 inline-block rounded-full bg-card/90 px-3 py-1 text-xs font-semibold shadow-card backdrop-blur">
          {visible.length} {visible.length === 1 ? "spot" : "spots"}
          {missing > 0 && !filters.size ? ` · ${missing} not on the map yet` : ""}
        </p>
      </div>

      <button
        onClick={locate}
        aria-label="Show spots near me"
        className="absolute bottom-4 right-3 z-[500] grid size-12 place-items-center rounded-full bg-card shadow-pop active:scale-90"
        style={{ bottom: selected ? "13.5rem" : "1rem" }}
      >
        <LocateFixed className="size-5 text-primary" />
      </button>

      {selected && (
        <div className="absolute inset-x-3 bottom-3 z-[600] overflow-hidden rounded-3xl bg-card shadow-pop animate-screen">
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
                <OpenBadge open={isOpenNow(selected.hours)} />
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
          {(extras.specials.get(selected.id) || extras.deals.get(selected.id)) && (
            <div className="space-y-1 px-3 text-sm">
              {extras.specials.get(selected.id) && (
                <p className="truncate">
                  ⭐ <b>House special:</b> {extras.specials.get(selected.id)?.name} ·{" "}
                  {formatPrice(extras.specials.get(selected.id)?.price_cents ?? 0)}
                </p>
              )}
              {(extras.deals.get(selected.id)?.drops ?? 0) +
                (extras.deals.get(selected.id)?.rescue ?? 0) >
                0 && (
                <Link to="/drops" className="flex items-center gap-1 font-semibold text-primary">
                  <Flame className="size-4" />
                  {[
                    extras.deals.get(selected.id)?.drops
                      ? `${extras.deals.get(selected.id)?.drops} live drop`
                      : "",
                    extras.deals.get(selected.id)?.rescue
                      ? `${extras.deals.get(selected.id)?.rescue} food to save`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Link>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 p-3">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noreferrer"
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
    </div>
  );
}
