import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LEVELS = [
  { level: 0, name: "Bronze", emoji: "🥉", min: 0 },
  { level: 1, name: "Silver", emoji: "🥈", min: 5 },
  { level: 2, name: "Gold", emoji: "🥇", min: 15 },
  { level: 3, name: "Maple", emoji: "🍁", min: 30 },
] as const;

export const STAMPS_PER_REWARD = 5;

export function levelFor(stamps: number) {
  return [...LEVELS].reverse().find((l) => stamps >= l.min) ?? LEVELS[0];
}

export function nextLevel(stamps: number) {
  return LEVELS.find((l) => l.min > stamps) ?? null;
}

export const levelName = (level: number) => LEVELS[Math.max(0, Math.min(3, level))]?.name ?? "Bronze";

/** Monday-based week key in Winnipeg time, e.g. "2026-10-26". */
function weekKey(date: Date) {
  const local = new Date(date.toLocaleString("en-US", { timeZone: "America/Winnipeg" }));
  const day = (local.getDay() + 6) % 7;
  local.setHours(0, 0, 0, 0);
  local.setDate(local.getDate() - day);
  return local.toISOString().slice(0, 10);
}

/** Consecutive weeks (ending this week or last week) with at least one stamp. */
export function weekStreak(dates: string[], now = new Date()) {
  const weeks = new Set(dates.map((d) => weekKey(new Date(d))));
  const cursor = new Date(now);
  if (!weeks.has(weekKey(cursor))) cursor.setDate(cursor.getDate() - 7);
  let streak = 0;
  while (weeks.has(weekKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

export function usePassport(userId: string | undefined) {
  return useQuery({
    queryKey: ["passport", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const [stamps, badges, mine, redemptions] = await Promise.all([
        supabase
          .from("stamps")
          .select("id, restaurant_id, source, created_at, restaurants(name, slug, logo_url, category, neighbourhood)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("badges").select("*").order("name"),
        supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", userId),
        supabase.from("reward_redemptions").select("restaurant_id, created_at").eq("user_id", userId),
      ]);
      if (stamps.error) throw stamps.error;
      return {
        stamps: stamps.data ?? [],
        badges: badges.data ?? [],
        earned: new Map((mine.data ?? []).map((b) => [b.badge_id, b.earned_at])),
        redemptions: redemptions.data ?? [],
      };
    },
  });
}
