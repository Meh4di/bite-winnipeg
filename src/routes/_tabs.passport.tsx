import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Flame, Gift, KeyRound, ScanLine, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { emojiFor } from "@/lib/bite";
import { LEVELS, STAMPS_PER_REWARD, levelFor, nextLevel, usePassport, weekStreak } from "@/lib/passport";

export const Route = createFileRoute("/_tabs/passport")({
  head: () => ({
    meta: [
      { title: "Passport — Bite" },
      { name: "description", content: "Collect stamps at Winnipeg spots, level up, earn badges and unlock secret menus." },
      { property: "og:title", content: "Passport — Bite" },
      { property: "og:description", content: "Your Winnipeg food passport." },
    ],
  }),
  component: Passport,
});

const SOURCE_LABEL: Record<string, string> = { visit: "Visit", order: "Pickup", drop: "Drop" };

function Passport() {
  const { user, loading } = useAuth();
  const passport = usePassport(user?.id);
  const qc = useQueryClient();
  const [redeemed, setRedeemed] = useState<{ name: string; at: string } | null>(null);
  const [showCode, setShowCode] = useState(false);

  const cards = useMemo(() => {
    const map = new Map<string, { id: string; name: string; slug: string; logo: string | null; category: string; count: number; used: number }>();
    for (const s of passport.data?.stamps ?? []) {
      if (!s.restaurants) continue;
      const c = map.get(s.restaurant_id) ?? {
        id: s.restaurant_id,
        name: s.restaurants.name,
        slug: s.restaurants.slug,
        logo: s.restaurants.logo_url,
        category: s.restaurants.category,
        count: 0,
        used: 0,
      };
      c.count += 1;
      map.set(s.restaurant_id, c);
    }
    for (const r of passport.data?.redemptions ?? []) {
      const c = map.get(r.restaurant_id);
      if (c) c.used += 1;
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [passport.data]);

  if (!loading && !user)
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-8 text-center animate-screen">
        <div className="grid size-28 place-items-center rounded-[2.5rem] bg-warm text-6xl shadow-pop">🍁</div>
        <h1 className="mt-6 text-3xl font-extrabold">Your Winnipeg food passport</h1>
        <p className="mt-2 max-w-xs text-muted-foreground">
          Collect stamps everywhere you eat, level up, earn badges and unlock secret menus.
        </p>
        <Button asChild size="xl" className="mt-6 w-full max-w-xs">
          <Link to="/auth" search={{ redirect: "/passport" }}>Start my passport</Link>
        </Button>
      </div>
    );

  if (loading || passport.isLoading) return <div className="m-5 h-56 animate-pulse rounded-3xl bg-muted" />;

  const stamps = passport.data?.stamps ?? [];
  const total = stamps.length;
  const lvl = levelFor(total);
  const next = nextLevel(total);
  const pct = next ? Math.round(((total - lvl.min) / (next.min - lvl.min)) * 100) : 100;
  const streak = weekStreak(stamps.map((s) => s.created_at));

  const redeem = async (c: (typeof cards)[number]) => {
    if (!confirm(`Redeem your reward at ${c.name}? Only tap this at the counter: staff need to see the next screen.`)) return;
    const { data, error } = await supabase.rpc("redeem_reward", { p_restaurant_id: c.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setRedeemed({ name: c.name, at: data?.[0]?.created_at ?? new Date().toISOString() });
    qc.invalidateQueries({ queryKey: ["passport"] });
  };

  if (redeemed)
    return (
      <div className="flex min-h-[85vh] flex-col items-center justify-center bg-success px-8 text-center text-success-foreground">
        <div className="grid size-32 place-items-center rounded-full bg-success-foreground/20 text-7xl animate-stamp">🎁</div>
        <h1 className="mt-6 text-4xl font-extrabold">Reward redeemed</h1>
        <p className="mt-2 text-xl font-bold">{redeemed.name}</p>
        <p className="mt-1 text-lg">
          {new Intl.DateTimeFormat("en-CA", { timeZone: "America/Winnipeg", dateStyle: "medium", timeStyle: "short" }).format(new Date(redeemed.at))}
        </p>
        <p className="mt-6 max-w-xs text-sm opacity-90">Show this screen to staff.</p>
        <Button variant="secondary" size="xl" className="mt-8 w-full max-w-xs" onClick={() => setRedeemed(null)}>
          Done
        </Button>
      </div>
    );

  return (
    <div className="animate-screen space-y-6 px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <h1 className="text-[2rem] font-extrabold leading-tight">Passport</h1>

      <section className="relative overflow-hidden rounded-3xl bg-warm p-5 text-primary-foreground shadow-pop">
        <span className="pointer-events-none absolute -right-6 -top-8 text-[9rem] opacity-15">🍁</span>
        <p className="text-sm font-semibold opacity-90">Level</p>
        <p className="flex items-center gap-2 font-display text-4xl font-extrabold">
          {lvl.emoji} {lvl.name}
        </p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-primary-foreground/25">
          <div className="h-full rounded-full bg-primary-foreground transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm opacity-90">
          {next
            ? `${next.min - total} more ${next.min - total === 1 ? "stamp" : "stamps"} to ${next.emoji} ${next.name}${next.level === 1 ? " and secret menus" : ""}`
            : "Top level. You're a Winnipeg legend."}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat value={total} label="Stamps" />
          <Stat value={cards.length} label="Spots" />
          <Stat value={streak} label={streak === 1 ? "Week streak" : "Week streak"} icon={streak > 0 ? <Flame className="size-4" /> : null} />
        </div>
      </section>

      <section className="rounded-3xl bg-card p-4 shadow-card">
        <h2 className="flex items-center gap-2 font-bold">
          <ScanLine className="size-5 text-primary" /> Get stamped
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan the Bite code at the counter with your camera, or pick up any order or drop. One visit stamp per spot per day.
        </p>
        {showCode ? (
          <ManualCode onDone={() => setShowCode(false)} />
        ) : (
          <Button variant="secondary" className="mt-3 h-11 w-full" onClick={() => setShowCode(true)}>
            <KeyRound className="size-4" /> Enter a counter code
          </Button>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Punch cards</h2>
        {cards.length === 0 && (
          <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
            No stamps yet. Every {STAMPS_PER_REWARD} stamps at a spot earns you a reward there.
          </p>
        )}
        <div className="space-y-3">
          {cards.map((c) => {
            const available = Math.floor(c.count / STAMPS_PER_REWARD) - c.used;
            const filled = available > 0 ? STAMPS_PER_REWARD : c.count % STAMPS_PER_REWARD;
            return (
              <div key={c.id} className="rounded-2xl bg-card p-4 shadow-card">
                <Link to="/r/$slug" params={{ slug: c.slug }} className="flex items-center gap-3">
                  {c.logo ? (
                    <img src={c.logo} alt="" className="size-10 rounded-xl object-cover" />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-xl bg-primary-soft">{emojiFor(c.category)}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.count} {c.count === 1 ? "stamp" : "stamps"}
                    </p>
                  </div>
                </Link>
                <div className="mt-3 flex gap-2" aria-label={`${filled} of ${STAMPS_PER_REWARD} stamps`}>
                  {Array.from({ length: STAMPS_PER_REWARD }, (_, i) => (
                    <span
                      key={i}
                      className={`grid aspect-square flex-1 place-items-center rounded-full border-2 text-lg ${
                        i < filled ? "border-primary bg-primary text-primary-foreground" : "border-dashed border-border"
                      }`}
                    >
                      {i < filled ? "🍁" : i === STAMPS_PER_REWARD - 1 ? <Gift className="size-4 text-muted-foreground" /> : ""}
                    </span>
                  ))}
                </div>
                {available > 0 && (
                  <Button className="mt-3 h-11 w-full" onClick={() => redeem(c)}>
                    <Gift className="size-4" /> Redeem reward{available > 1 ? ` (${available})` : ""}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Badges</h2>
        <div className="grid grid-cols-3 gap-2">
          {(passport.data?.badges ?? []).map((b) => {
            const earned = passport.data?.earned.has(b.id);
            return (
              <div
                key={b.id}
                className={`flex flex-col items-center rounded-2xl bg-card p-3 text-center shadow-card ${earned ? "" : "opacity-50 grayscale"}`}
                title={b.description ?? ""}
              >
                <span className="text-3xl">{b.icon}</span>
                <span className="mt-1 text-xs font-bold leading-tight">{b.name}</span>
                <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{b.description}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Levels</h2>
        <div className="grid grid-cols-4 gap-2">
          {LEVELS.map((l) => (
            <div
              key={l.level}
              className={`rounded-2xl p-3 text-center ${l.level === lvl.level ? "bg-primary-soft ring-2 ring-primary" : "bg-card shadow-card"}`}
            >
              <p className="text-2xl">{l.emoji}</p>
              <p className="text-xs font-bold">{l.name}</p>
              <p className="text-[10px] text-muted-foreground">{l.min}+</p>
            </div>
          ))}
        </div>
      </section>

      {stamps.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Recent stamps</h2>
          <ul className="divide-y rounded-2xl bg-card shadow-card">
            {stamps.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span>🍁</span>
                <span className="flex-1 truncate font-semibold">{s.restaurants?.name}</span>
                <span className="text-xs text-muted-foreground">
                  {SOURCE_LABEL[s.source]} · {new Date(s.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ value, label, icon }: { value: number; label: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-primary-foreground/15 py-2">
      <p className="flex items-center justify-center gap-1 font-display text-2xl font-extrabold">
        {icon}
        {value}
      </p>
      <p className="text-[11px] font-semibold opacity-90">{label}</p>
    </div>
  );
}

function ManualCode({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");
  const [code, setCode] = useState("");
  const spots = useQuery({
    queryKey: ["restaurants-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurants").select("slug, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });
  const go = () => {
    const c = code.trim().toUpperCase();
    if (!slug || c.length !== 6) {
      toast.error("Pick the spot and enter the 6-character code");
      return;
    }
    navigate({ to: "/stamp/$slug/$code", params: { slug, code: c } });
  };
  return (
    <div className="mt-3 space-y-2">
      <label className="sr-only" htmlFor="stamp-spot">Spot</label>
      <div className="flex h-12 items-center gap-2 rounded-2xl border bg-background px-3">
        <Store className="size-4 text-muted-foreground" />
        <select id="stamp-spot" value={slug} onChange={(e) => setSlug(e.target.value)} className="h-full flex-1 bg-transparent text-base outline-none">
          <option value="">Which spot?</option>
          {spots.data?.map((s) => (
            <option key={s.slug} value={s.slug}>{s.name}</option>
          ))}
        </select>
      </div>
      <input
        aria-label="Counter code"
        value={code}
        maxLength={6}
        onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, ""))}
        placeholder="CODE12"
        className="h-12 w-full rounded-2xl border bg-background px-4 text-center font-mono text-xl font-bold uppercase tracking-[0.3em] outline-none focus:border-primary"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="h-11 flex-1" onClick={onDone}>Cancel</Button>
        <Button className="h-11 flex-1" onClick={go}>Stamp me</Button>
      </div>
    </div>
  );
}
