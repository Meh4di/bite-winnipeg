import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

/** Bity's colours for the OpenFreeMap basemap, applied by layer type and source layer. */
const PALETTE = {
  light: {
    background: "#f6f1e9",
    water: "#bcdcee",
    waterLine: "#9fcbe4",
    park: "#d7ebcf",
    wood: "#cfe5c4",
    building: "#ebe2d6",
    road: "#ffffff",
    roadMajor: "#fff6e8",
    casing: "#e6dacb",
    label: "#5c4a3d",
    halo: "#fffaf3",
  },
  dark: {
    background: "#16141b",
    water: "#1b2737",
    waterLine: "#223246",
    park: "#1a2620",
    wood: "#1a2620",
    building: "#211e27",
    road: "#2b2733",
    roadMajor: "#3a3343",
    casing: "#1d1a22",
    label: "#b9b0c4",
    halo: "#16141b",
  },
} as const;

type Paint = Record<string, unknown>;
const srcLayer = (l: LayerSpecification) =>
  "source-layer" in l ? (l["source-layer"] as string | undefined) : undefined;

/** Recolours the style and drops POI clutter. Works by layer type and source layer, not ids. */
export function bityStyle(style: StyleSpecification, mode: "light" | "dark"): StyleSpecification {
  const c = PALETTE[mode];
  const layers: LayerSpecification[] = [];
  for (const layer of style.layers) {
    const sl = srcLayer(layer);
    const id = layer.id.toLowerCase();
    // Remove shop/POI icons and labels, house numbers and aerodrome labels.
    if (sl === "poi" || sl === "housenumber" || sl === "aerodrome_label" || id.includes("poi"))
      continue;
    const l = {
      ...layer,
      paint: { ...(layer.paint as Paint | undefined) },
    } as LayerSpecification & {
      paint: Paint;
    };
    if (l.type === "background") l.paint["background-color"] = c.background;
    else if (sl === "water" && l.type === "fill") l.paint["fill-color"] = c.water;
    else if (sl === "waterway" && l.type === "line") l.paint["line-color"] = c.waterLine;
    else if ((sl === "park" || (sl === "landcover" && /grass|park/.test(id))) && l.type === "fill")
      l.paint["fill-color"] = c.park;
    else if (sl === "landcover" && /wood|forest/.test(id) && l.type === "fill")
      l.paint["fill-color"] = c.wood;
    else if (sl === "building" && l.type === "fill") {
      l.paint["fill-color"] = c.building;
      l.paint["fill-outline-color"] = c.casing;
    } else if (sl === "transportation" && l.type === "line") {
      if (id.includes("casing")) l.paint["line-color"] = c.casing;
      else if (/motorway|trunk|primary|major/.test(id)) l.paint["line-color"] = c.roadMajor;
      else if (!/rail|path|ferry|aeroway/.test(id)) l.paint["line-color"] = c.road;
    } else if (
      l.type === "symbol" &&
      (sl === "place" || sl === "transportation_name" || sl === "water_name")
    ) {
      l.paint["text-color"] =
        sl === "water_name" ? (mode === "light" ? "#5d8fb0" : "#6f8fb0") : c.label;
      l.paint["text-halo-color"] = c.halo;
      l.paint["text-halo-width"] = 1.4;
    }
    layers.push(l);
  }
  return { ...style, layers };
}
