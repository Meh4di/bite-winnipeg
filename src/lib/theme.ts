import { useEffect, useState } from "react";

export type ThemeChoice = "auto" | "light" | "dark";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
}

export function applyTheme(choice: ThemeChoice) {
  const el = document.documentElement;
  el.classList.remove("light", "dark");
  if (choice !== "auto") el.classList.add(choice);
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("auto");
  useEffect(() => {
    const saved = read("bite-theme");
    if (saved === "light" || saved === "dark") setChoice(saved);
  }, []);
  const set = (c: ThemeChoice) => {
    setChoice(c);
    write("bite-theme", c === "auto" ? null : c);
    applyTheme(c);
  };
  return [choice, set] as const;
}

/** Demo switch so Polar Vortex mode can be seen outside of a Winnipeg cold snap. */
export function getVortexPreview() {
  return read("bite-vortex-preview") === "1";
}
export function setVortexPreview(on: boolean) {
  write("bite-vortex-preview", on ? "1" : null);
  window.dispatchEvent(new Event("bite-vortex-preview"));
}
