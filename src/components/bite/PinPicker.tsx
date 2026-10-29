import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const WINNIPEG: [number, number] = [49.8951, -97.1384];
const icon = L.divIcon({
  html: '<div class="bite-pin" style="--ring:#fff"><span class="bite-pin-emoji">📍</span></div>',
  className: "",
  iconSize: [48, 48],
  iconAnchor: [24, 44],
});

function Recenter({ to }: { to: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (to) map.setView(to, 16);
  }, [to, map]);
  return null;
}
function ClickToMove({ onPick }: { onPick: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

/** Owner places their spot: look up the address, then drag or tap to fine-tune. */
export default function PinPicker({
  address,
  lat,
  lng,
  onChange,
}: {
  address: string;
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const pos: [number, number] | null = lat !== null && lng !== null ? [lat, lng] : null;
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [looking, setLooking] = useState(false);

  const find = async () => {
    if (!address.trim()) {
      toast.error("Type your street address first");
      return;
    }
    setLooking(true);
    try {
      const q = encodeURIComponent(`${address}, Winnipeg, Manitoba, Canada`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ca&q=${q}`,
        {
          headers: { "Accept-Language": "en" },
        },
      );
      const hits = (await res.json()) as { lat: string; lon: string }[];
      const hit = hits[0];
      if (!hit) {
        toast.error("Couldn't find that address. Tap the map to place your pin instead.");
        setCenter(WINNIPEG);
        return;
      }
      const p: [number, number] = [Number(hit.lat), Number(hit.lon)];
      onChange(p[0], p[1]);
      setCenter(p);
    } catch {
      toast.error("Address lookup failed. Tap the map to place your pin.");
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <MapPin className="size-4 text-primary" /> Your spot on the map
        </p>
        <Button
          type="button"
          variant="secondary"
          className="h-9 px-3 text-sm"
          onClick={find}
          disabled={looking}
        >
          <Search className="size-4" /> {looking ? "Looking…" : "Find my address"}
        </Button>
      </div>
      <div className="isolate h-52 overflow-hidden rounded-2xl border">
        <MapContainer
          center={pos ?? WINNIPEG}
          zoom={pos ? 16 : 12}
          className="size-full"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <Recenter to={center} />
          <ClickToMove onPick={(p) => onChange(p[0], p[1])} />
          {pos && (
            <Marker
              position={pos}
              icon={icon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  onChange(ll.lat, ll.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        {pos
          ? "Drag the pin or tap the map if it's not quite right."
          : "Not on the map yet. Find your address or tap the map."}
      </p>
    </div>
  );
}
