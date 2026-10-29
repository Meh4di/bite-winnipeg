import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, emojiFor, isOpenNow } from "@/lib/bite";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RestaurantCard } from "@/components/bite/RestaurantCard";

export const Route = createFileRoute("/_tabs/decide")({
  head: () => ({
    meta: [
      { title: "Decide — Bite" },
      { name: "description", content: "Can't choose where to eat? Spin the roulette or swipe with friends." },
      { property: "og:title", content: "Decide — Bite" },
      { property: "og:description", content: "Spin or swipe to pick where to eat in Winnipeg." },
    ],
  }),
  component: Decide,
});

export function useRestaurants() {
  return useQuery({
    queryKey: ["restaurants", "decide"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, slug, name, category, neighbourhood, cover_url, logo_url, hours, description")
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

function Decide() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const restaurants = useRestaurants();
  const [cat, setCat] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [reel, setReel] = useState<string | null>(null);
  const [pickId, setPickId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const pool = useMemo(
    () => (restaurants.data ?? []).filter((r) => (!cat || r.category === cat) && (!openOnly || isOpenNow(r.hours))),
    [restaurants.data, cat, openOnly],
  );
  const pick = (restaurants.data ?? []).find((r) => r.id === pickId) ?? null;

  const spin = () => {
    if (!pool.length || spinning) return;
    const winner = pool[Math.floor(Math.random() * pool.length)];
    if (!winner) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSpinning(true);
    setPickId(null);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const steps = reduce ? 1 : 22;
    let t = 0;
    for (let i = 0; i < steps; i++) {
      t += 45 + Math.pow(i / steps, 3) * 320;
      const last = i === steps - 1;
      const name = last ? winner.name : pool[Math.floor(Math.random() * pool.length)]?.name ?? winner.name;
      timers.current.push(
        window.setTimeout(() => {
          setReel(name);
          if (last) {
            setPickId(winner.id);
            setSpinning(false);
            navigator.vibrate?.(30);
          }
        }, t),
      );
    }
  };

  const startGroup = async () => {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/decide" } });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.rpc("create_decide_session", cat ? { p_category: cat } : {});
    setCreating(false);
    if (error || !data?.[0]) {
      toast.error(error?.message ?? "Couldn't start a group");
      return;
    }
    navigate({ to: "/decide/$code", params: { code: data[0].code } });
  };

  const join = () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length !== 5) {
      toast.error("Group codes are 5 characters");
      return;
    }
    navigate({ to: "/decide/$code", params: { code: c } });
  };

  return (
    <div className="animate-screen space-y-6 px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <div>
        <h1 className="text-[2rem] font-extrabold leading-tight">Decide</h1>
        <p className="text-sm text-muted-foreground">Can't choose? Let fate (or your friends) pick.</p>
      </div>

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip active={!cat} onClick={() => setCat(null)}>✨ Anything</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.name} active={cat === c.name} onClick={() => setCat(cat === c.name ? null : c.name)}>
            {c.emoji} {c.name}
          </Chip>
        ))}
      </div>

      <section className="rounded-3xl bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <Dices className="size-6 text-primary" /> Roulette
          </h2>
          <label className="flex items-center gap-2 text-sm font-semibold">
            Open now <Switch checked={openOnly} onCheckedChange={setOpenOnly} />
          </label>
        </div>
        <div
          className="mt-4 grid h-24 place-items-center overflow-hidden rounded-2xl bg-warm px-4 text-center text-primary-foreground"
          aria-live="polite"
        >
          <p className={`font-display text-2xl font-extrabold leading-tight ${spinning ? "blur-[0.5px]" : ""}`}>
            {reel ?? (pool.length ? `${pool.length} ${pool.length === 1 ? "spot" : "spots"} in the wheel` : "No spots match")}
          </p>
        </div>
        <Button size="xl" className="mt-4 w-full" onClick={spin} disabled={!pool.length || spinning}>
          {spinning ? "Spinning…" : pickId ? "Spin again" : "Spin 🎲"}
        </Button>
        {pick && !spinning && (
          <div className="mt-4 animate-screen">
            <p className="mb-2 text-center text-sm font-bold text-primary">Fate has spoken {emojiFor(pick.category)}</p>
            <RestaurantCard r={pick} />
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-card p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-xl font-extrabold">
          <Users className="size-6 text-primary" /> Swipe with friends
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a group, share the code, and everyone swipes. When you all like the same spot, it's a match.
        </p>
        <Button size="xl" className="mt-4 w-full" onClick={startGroup} disabled={creating}>
          {creating ? "Starting…" : `Start a group${cat ? ` · ${cat}` : ""}`}
        </Button>
        <div className="mt-3 flex gap-2">
          <input
            aria-label="Group code"
            value={joinCode}
            maxLength={5}
            onChange={(e) => setJoinCode(e.target.value.replace(/[^a-z0-9]/gi, ""))}
            placeholder="CODE"
            className="h-12 min-w-0 flex-1 rounded-2xl border bg-background px-4 text-center font-mono text-lg font-bold uppercase tracking-[0.3em] outline-none focus:border-primary"
          />
          <Button variant="secondary" className="h-12 px-5" onClick={join}>
            Join
          </Button>
        </div>
        {!user && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            You'll need to <Link to="/auth" search={{ redirect: "/decide" }} className="font-semibold text-primary">sign in</Link> to swipe with friends.
          </p>
        )}
      </section>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-all active:scale-95 ${
        active ? "bg-primary text-primary-foreground shadow-pop" : "bg-card shadow-card"
      }`}
    >
      {children}
    </button>
  );
}
