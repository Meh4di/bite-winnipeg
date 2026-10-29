import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Eye, LogOut, Store, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { isOpenNow } from "@/lib/bite";
import { OpenBadge } from "@/components/bite/RestaurantCard";
import { useMyRestaurant } from "./owner";
import { OwnerOrders } from "@/components/bite/OwnerOrders";

export const Route = createFileRoute("/owner/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: r, isLoading } = useMyRestaurant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const stats = useQuery({
    queryKey: ["owner-stats", r?.id],
    enabled: !!r,
    queryFn: async () => {
      if (!r) return { items: 0, follows: 0 };
      const [items, follows] = await Promise.all([
        supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
        supabase.from("follows").select("user_id", { count: "exact", head: true }).eq("restaurant_id", r.id),
      ]);
      return { items: items.count ?? 0, follows: follows.count ?? 0 };
    },
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading) return <div className="m-5 h-40 animate-pulse rounded-3xl bg-muted" />;

  if (!r)
    return (
      <div className="px-6 pt-12 text-center animate-screen">
        <p className="text-6xl">👩‍🍳</p>
        <h1 className="mt-4 text-3xl font-extrabold">Let's get your spot on Bite</h1>
        <p className="mt-2 text-muted-foreground">Add your details, hours and photos. Takes about 3 minutes.</p>
        <Button asChild size="xl" className="mt-6 w-full">
          <Link to="/owner/setup">Set up my restaurant</Link>
        </Button>
        <Button variant="ghost" className="mt-4" onClick={signOut}>
          Log out
        </Button>
      </div>
    );

  return (
    <div className="space-y-4 px-5 pt-5 animate-screen">
      <h1 className="text-2xl font-extrabold">{r.name}</h1>
      <OwnerOrders restaurant={r} />
      <div className="overflow-hidden rounded-3xl bg-card shadow-card">
        <div className="relative h-32 bg-muted">
          {r.cover_url && <img src={r.cover_url} alt="" className="size-full object-cover" />}
          <div className="absolute left-3 top-3">
            <OpenBadge open={isOpenNow(r.hours)} />
          </div>
        </div>
        <div className="p-4">
          <h2 className="text-2xl font-extrabold">{r.name}</h2>
          <p className="text-sm text-muted-foreground">
            {r.category} · {r.neighbourhood}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Menu items" value={stats.data?.items} />
        <Stat label="Followers" value={stats.data?.follows} />
      </div>
      <Button asChild size="xl" className="w-full">
        <Link to="/r/$slug" params={{ slug: r.slug }}>
          <Eye className="size-5" /> Preview my page
        </Link>
      </Button>
      <Row to="/owner/menu" icon={UtensilsCrossed} label="Manage menu" />
      <Row to="/owner/setup" icon={Store} label="Edit details, hours & photos" />
      <button onClick={signOut} className="flex h-14 w-full items-center gap-3 px-4 text-muted-foreground">
        <LogOut className="size-5" /> Log out
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number | undefined }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-card">
      <p className="font-display text-3xl font-extrabold text-primary">{value ?? "–"}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ to, icon: Icon, label }: { to: "/owner/menu" | "/owner/setup"; icon: typeof Store; label: string }) {
  return (
    <Link to={to} className="flex h-16 items-center gap-3 rounded-2xl bg-card px-4 shadow-card active:scale-[0.98]">
      <Icon className="size-5 text-primary" />
      <span className="flex-1 font-semibold">{label}</span>
      <ChevronRight className="size-5 text-muted-foreground" />
    </Link>
  );
}
