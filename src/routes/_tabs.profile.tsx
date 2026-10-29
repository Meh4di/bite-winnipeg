import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, LogOut, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { emojiFor } from "@/lib/bite";

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
        <p className="mt-2 text-muted-foreground">Follow your favourite spots and start collecting stamps.</p>
        <Button asChild size="xl" className="mt-6 w-full">
          <Link to="/auth">Sign in or create account</Link>
        </Button>
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
                <img src={f.restaurants.logo_url} alt="" className="size-12 rounded-xl object-cover" />
              ) : (
                <div className="grid size-12 place-items-center rounded-xl bg-primary-soft text-xl">
                  {emojiFor(f.restaurants.category)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{f.restaurants.name}</p>
                <p className="truncate text-sm text-muted-foreground">{f.restaurants.neighbourhood}</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          ) : null,
        )}
      </div>

      <Button variant="outline" size="xl" className="mt-8 w-full shadow-none" onClick={signOut}>
        <LogOut className="size-5" /> Log out
      </Button>
    </div>
  );
}
