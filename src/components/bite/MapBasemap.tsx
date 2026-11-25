import { useCallback, useEffect, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreGL from "@maplibre/maplibre-gl-leaflet";
import type { StyleSpecification } from "maplibre-gl";
import { bityStyle } from "@/lib/mapStyle";

/**
 * Bity's basemap: OpenFreeMap vector tiles (free, no API key) restyled in Bity's warm palette,
 * with shop/POI icons removed so food pins are the only thing that pops. Dark mode uses the dark
 * style. If WebGL or the style can't load, it falls back to plain OpenStreetMap tiles.
 */
const STYLE_URL = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function VectorLayer({ mode, onFail }: { mode: "light" | "dark"; onFail: () => void }) {
  const map = useMap();
  useEffect(() => {
    let layer: ReturnType<typeof maplibreGL> | null = null;
    let loaded = false;
    let cancelled = false;
    const giveUp = window.setTimeout(() => {
      if (!loaded && !cancelled) onFail();
    }, 9000);
    (async () => {
      try {
        const res = await fetch(STYLE_URL[mode]);
        if (!res.ok) throw new Error(`style ${res.status}`);
        const style = bityStyle((await res.json()) as StyleSpecification, mode);
        if (cancelled) return;
        layer = maplibreGL({ style, attributionControl: false });
        layer.addTo(map);
        const gl = layer.getMaplibreMap();
        gl.once("load", () => {
          loaded = true;
        });
        gl.on("error", (e) => {
          // Missing single tiles are fine; only bail if the map never got going.
          if (!loaded && !cancelled && String(e?.error?.message ?? "").includes("style")) onFail();
        });
        map.attributionControl?.addAttribution(
          '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        );
      } catch {
        if (!cancelled) onFail();
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(giveUp);
      if (layer) map.removeLayer(layer);
    };
  }, [map, mode, onFail]);
  return null;
}

function useThemeMode(): "light" | "dark" {
  const read = () =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  const [mode, setMode] = useState<"light" | "dark">(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setMode(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return mode;
}

export function MapBasemap({ onRaster }: { onRaster?: (raster: boolean) => void }) {
  const mode = useThemeMode();
  const [raster, setRaster] = useState(() => typeof window !== "undefined" && !webglOK());
  const fail = useCallback(() => setRaster(true), []);
  useEffect(() => onRaster?.(raster), [raster, onRaster]);
  if (raster)
    return (
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
    );
  return <VectorLayer key={mode} mode={mode} onFail={fail} />;
}
