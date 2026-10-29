import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getVortexPreview } from "@/lib/theme";

/** Polar Vortex mode switches on at this "feels like" temperature. */
export const VORTEX_AT_C = -25;
const PREVIEW_TEMP_C = -32;

type Weather = { temp: number; feelsLike: number };

/** Current Winnipeg weather from Open-Meteo (free, no key). */
export function useWinnipegWeather() {
  return useQuery({
    queryKey: ["weather", "winnipeg"],
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
    queryFn: async (): Promise<Weather> => {
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=49.8951&longitude=-97.1384&current=temperature_2m,apparent_temperature&timezone=America%2FWinnipeg",
      );
      if (!res.ok) throw new Error("Weather unavailable");
      const j = (await res.json()) as {
        current: { temperature_2m: number; apparent_temperature: number };
      };
      return {
        temp: Math.round(j.current.temperature_2m),
        feelsLike: Math.round(j.current.apparent_temperature),
      };
    },
  });
}

/** Whether Polar Vortex mode is on, the "feels like" temperature, and whether it's a preview. */
export function useVortex() {
  const weather = useWinnipegWeather();
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    const sync = () => setPreview(getVortexPreview());
    sync();
    window.addEventListener("bite-vortex-preview", sync);
    return () => window.removeEventListener("bite-vortex-preview", sync);
  }, []);
  const feelsLike = preview ? PREVIEW_TEMP_C : (weather.data?.feelsLike ?? null);
  const active = feelsLike !== null && feelsLike <= VORTEX_AT_C;

  useEffect(() => {
    document.documentElement.classList.toggle("vortex", active);
  }, [active]);

  return {
    active,
    feelsLike,
    temp: preview ? PREVIEW_TEMP_C : (weather.data?.temp ?? null),
    preview,
  };
}
