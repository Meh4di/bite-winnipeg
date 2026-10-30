import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Person = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export const firstName = (p?: Pick<Person, "full_name"> | null) =>
  p?.full_name?.trim().split(/\s+/)[0] || "Foodie";

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Profiles are public (name, @username, avatar, bio); everything else is behind RLS. */
export function usePeople(ids: string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["people", key],
    enabled: key.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, bio")
        .in("id", key);
      if (error) throw error;
      return new Map((data as Person[]).map((p) => [p.id, p]));
    },
  });
}

export function useSpots() {
  return useQuery({
    queryKey: ["spots", "social"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, slug, name, category, neighbourhood, cover_url, logo_url")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export type FeedItem = {
  id: string;
  user_id: string;
  kind: string;
  restaurant_id: string | null;
  badge_id: string | null;
  rating: number | null;
  created_at: string;
  fires: number;
  mine: boolean;
};

/** Friends' activity. The database only returns your own items and mutual friends' items older than 1 hour. */
export function useFeed(userId: string | undefined) {
  return useQuery({
    queryKey: ["feed", userId],
    enabled: !!userId,
    queryFn: async (): Promise<FeedItem[]> => {
      const { data, error } = await supabase
        .from("activity")
        .select("id, user_id, kind, restaurant_id, badge_id, rating, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const ids = data.map((a) => a.id);
      const { data: rx } = ids.length
        ? await supabase
            .from("activity_reactions")
            .select("activity_id, user_id")
            .in("activity_id", ids)
        : { data: [] as { activity_id: string; user_id: string }[] };
      return data.map((a) => {
        const mine = (rx ?? []).filter((r) => r.activity_id === a.id);
        return {
          ...a,
          fires: mine.length,
          mine: mine.some((r) => r.user_id === userId),
        };
      });
    },
  });
}

export function useBadges() {
  return useQuery({
    queryKey: ["badges"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("id, name, icon");
      return new Map((data ?? []).map((b) => [b.id, b]));
    },
  });
}

export function useMeetups(enabled: boolean) {
  return useQuery({
    queryKey: ["meetups"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_meetups");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMatches(enabled: boolean) {
  return useQuery({
    queryKey: ["taste-matches"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("taste_match_people");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMySocial(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-social", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: p }, { data: priv }] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, bio, discoverable, share_activity")
          .eq("id", userId!)
          .maybeSingle(),
        supabase.from("profile_private").select("birth_date").eq("user_id", userId!).maybeSingle(),
      ]);
      return {
        username: p?.username ?? null,
        bio: p?.bio ?? null,
        discoverable: p?.discoverable ?? false,
        share_activity: p?.share_activity ?? true,
        birth_date: priv?.birth_date ?? null,
      };
    },
  });
}

/** Who I follow and who follows me (RLS only returns edges that involve me). */
export function useMyEdges(userId: string | undefined) {
  return useQuery({
    queryKey: ["edges", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_follows")
        .select("follower_id, followee_id");
      if (error) throw error;
      const following = new Set<string>();
      const followers = new Set<string>();
      for (const e of data) {
        if (e.follower_id === userId) following.add(e.followee_id);
        if (e.followee_id === userId) followers.add(e.follower_id);
      }
      return { following, followers };
    },
  });
}

export function isAdultDate(birth: string | null | undefined, now = new Date()) {
  if (!birth) return false;
  const b = new Date(birth + "T00:00:00");
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  return b <= cutoff;
}

export function feedLine(kind: string): { verb: string; emoji: string } {
  switch (kind) {
    case "rescue":
      return { verb: "rescued food at", emoji: "♻️" };
    case "review":
      return { verb: "reviewed", emoji: "⭐" };
    case "badge":
      return { verb: "earned a badge", emoji: "🏅" };
    case "forward":
      return { verb: "paid a meal forward at", emoji: "💛" };
    case "unlock":
      return { verb: "joined an unlock deal at", emoji: "🔓" };
    case "table":
      return { verb: "opened a table at", emoji: "🍽️" };
    default:
      return { verb: "got a stamp at", emoji: "🍁" };
  }
}

export function timeAgo(iso: string, now = Date.now()) {
  const m = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d` : `${Math.round(d / 7)}w`;
}

export function matchTone(score: number) {
  if (score >= 75) return { label: "Taste twin", cls: "bg-primary text-primary-foreground" };
  if (score >= 50) return { label: "Great match", cls: "bg-success text-success-foreground" };
  if (score >= 25) return { label: "Some overlap", cls: "bg-amber-500 text-white" };
  return { label: "Different tastes", cls: "bg-secondary text-foreground" };
}

const RULES_KEY = "bite-table-rules-ok";
export function rulesAccepted() {
  try {
    return localStorage.getItem(RULES_KEY) === "1";
  } catch {
    return false;
  }
}
export function acceptRules() {
  try {
    localStorage.setItem(RULES_KEY, "1");
  } catch {
    /* private mode: they'll just see the rules again */
  }
}
