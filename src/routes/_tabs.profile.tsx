import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, LogOut, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { emojiFor } from "@/lib/bite";
import { OrderHistory } from "@/components/bite/OrderHistory";
import { useEffect, useState } from "react";
import { Moon, Snowflake, Sun, SunMoon, Trophy, Footprints } from "lucide-react";
import { getVortexPreview, setVortexPreview, useTheme, type ThemeChoice } from "@/lib/theme";

export const Route = createFileRoute("/_tabs/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Bite" },
      { name: "description", content: "Your Bite profile and followed Winnipeg restaurants." },
      { property: "og:title", content: "Profile — Bite" },
      { property: "og:description", content: "Your Bite profile." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { user, role, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  const follows = useQuery({
    queryKey: ["follows", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("restaurant_id, restaurants(slug, name, category, neighbourhood, logo_url)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!loading && !user) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-8 text-center animate-screen">
        <div className="text-6xl">🍩</div>
        <h1 className="mt-4 text-3xl font-extrabold">Join Bite</h1>
        <p className="mt-2 text-muted-foreground">
          Follow your favourite spots and start collecting stamps.
        </p>
        <Button asChild size="xl" className="mt-6 w-full">
          <Link to="/auth">Sign in or create account</Link>
        </Button>
        <div className="w-full text-left">
          <Settings />
        </div>
      </div>
    );
  }

  const name = profile.data?.full_name ?? user?.email ?? "";
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="animate-screen px-5 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <div className="flex flex-col items-center rounded-3xl bg-card p-6 text-center shadow-card">
        {profile.data?.avatar_url ? (
          <img src={profile.data.avatar_url} alt="" className="size-24 rounded-full object-cover" />
        ) : (
          <div className="grid size-24 place-items-center rounded-full bg-warm font-display text-4xl font-extrabold text-primary-foreground">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="mt-3 text-2xl font-extrabold">{name}</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <span className="mt-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
          {role === "restaurant_owner" ? "Restaurant owner" : "Foodie"}
        </span>
      </div>

      {role === "restaurant_owner" && (
        <Link
          to="/owner"
          className="mt-4 flex h-16 items-center gap-3 rounded-2xl bg-card px-4 shadow-card active:scale-[0.98]"
        >
          <Store className="size-5 text-primary" />
          <span className="flex-1 font-semibold">Restaurant dashboard</span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
      )}

      {user && <OrderHistory />}
      <h2 className="mb-3 mt-7 text-xl font-bold">Following</h2>
      <div className="space-y-2">
        {follows.data?.length === 0 && (
          <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
            You're not following anyone yet. Tap Follow on a restaurant page.
          </p>
        )}
        {follows.data?.map((f) =>
          f.restaurants ? (
            <Link
              key={f.restaurant_id}
              to="/r/$slug"
              params={{ slug: f.restaurants.slug }}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card active:scale-[0.98]"
            >
              {f.restaurants.logo_url ? (
                <img
                  src={f.restaurants.logo_url}
                  alt=""
                  className="size-12 rounded-xl object-cover"
                />
              ) : (
                <div className="grid size-12 place-items-center rounded-xl bg-primary-soft text-xl">
                  {emojiFor(f.restaurants.category)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{f.restaurants.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {f.restaurants.neighbourhood}
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          ) : null,
        )}
      </div>

      <Settings />

      <Button variant="outline" size="xl" className="mt-8 w-full shadow-none" onClick={signOut}>
        <LogOut className="size-5" /> Log out
      </Button>
    </div>
  );
}

function Settings() {
  const [theme, setTheme] = useTheme();
  const [vortex, setVortex] = useState(false);
  useEffect(() => setVortex(getVortexPreview()), []);
  const opts: { key: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
    { key: "auto", label: "Auto", icon: SunMoon },
  ];
  return (
    <section className="mt-7 space-y-3">
      <h2 className="text-xl font-bold">Explore</h2>
      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/best"
          className="flex items-center gap-2 rounded-2xl bg-secondary p-4 font-semibold"
        >
          <Trophy className="size-5 text-primary" /> Best in the Peg
        </Link>
        <Link
          to="/crawls"
          className="flex items-center gap-2 rounded-2xl bg-secondary p-4 font-semibold"
        >
          <Footprints className="size-5 text-primary" /> Food crawls
        </Link>
        <Link
          to="/for-restaurants"
          className="col-span-2 flex items-center gap-2 rounded-2xl bg-secondary p-4 font-semibold"
        >
          <span className="text-lg">👩‍🍳</span> Own a restaurant? List it free
        </Link>
      </div>
      <h2 className="pt-3 text-xl font-bold">Appearance</h2>
      <div
        className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1"
        role="radiogroup"
        aria-label="Theme"
      >
        {opts.map((o) => (
          <button
            key={o.key}
            role="radio"
            aria-checked={theme === o.key}
            onClick={() => setTheme(o.key)}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold ${
              theme === o.key ? "bg-card shadow-card" : "text-muted-foreground"
            }`}
          >
            <o.icon className="size-4" /> {o.label}
          </button>
        ))}
      </div>
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-secondary p-4">
        <span className="flex items-center gap-3">
          <Snowflake className="size-5 text-sky-600" />
          <span>
            <span className="block font-semibold">Preview Polar Vortex mode</span>
            <span className="block text-xs text-muted-foreground">
              See the app at -32°C. Turns on by itself when it's really that cold.
            </span>
          </span>
        </span>
        <input
          type="checkbox"
          className="size-5 accent-[var(--primary)]"
          checked={vortex}
          onChange={(e) => {
            setVortex(e.target.checked);
            setVortexPreview(e.target.checked);
          }}
        />
      </label>
    </section>
  );
}
