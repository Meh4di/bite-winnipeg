import { supabase } from "@/integrations/supabase/client";

export const CATEGORIES = [
  { name: "Coffee", emoji: "☕" },
  { name: "Bakery", emoji: "🥐" },
  { name: "Tacos", emoji: "🌮" },
  { name: "Pizza", emoji: "🍕" },
  { name: "Asian", emoji: "🍜" },
  { name: "Brunch", emoji: "🥞" },
  { name: "Dessert", emoji: "🍰" },
] as const;

export const NEIGHBOURHOODS = [
  "Exchange District",
  "Osborne Village",
  "Corydon",
  "St. Boniface",
  "The Forks",
  "West End",
  "Downtown",
  "Wolseley",
  "St. Vital",
  "Transcona",
];

export const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

export type DayHours = { open?: string; close?: string; closed?: boolean };
export type Hours = Partial<Record<(typeof DAYS)[number]["key"], DayHours>>;

export const emojiFor = (cat: string) => CATEGORIES.find((c) => c.name === cat)?.emoji ?? "🍽️";

export const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Current weekday key + "HH:MM" in Winnipeg time. */
export function winnipegNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Winnipeg",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: get("weekday").toLowerCase().slice(0, 3), time: `${get("hour")}:${get("minute")}` };
}

export function isOpenNow(hours: unknown, date = new Date()): boolean {
  const h = (hours ?? {}) as Hours;
  const { day, time } = winnipegNow(date);
  const today = h[day as keyof Hours];
  if (!today || today.closed || !today.open || !today.close) return false;
  return time >= today.open && time < today.close;
}

export function formatTime(t?: string) {
  if (!t) return "";
  const [hh, mm] = t.split(":").map(Number);
  const ap = hh >= 12 ? "pm" : "am";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return mm ? `${h12}:${String(mm).padStart(2, "0")}${ap}` : `${h12}${ap}`;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export type ImageBucket = "restaurant-logos" | "restaurant-covers" | "menu-photos";

/** Uploads into the owner's folder and returns a long-lived signed URL (buckets are private). */
export async function uploadImage(bucket: ImageBucket, userId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data, error: e2 } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (e2) throw e2;
  return data.signedUrl;
}
