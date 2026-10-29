import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { ShoppingBag, Store, UtensilsCrossed, Eye, Zap, QrCode } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchRole } from "@/lib/auth";

export const Route = createFileRoute("/owner")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    if ((await fetchRole(data.user.id)) !== "restaurant_owner") throw redirect({ to: "/" });
    return { userId: data.user.id };
  },
  head: () => ({
    meta: [
      { title: "Restaurant dashboard — Bite" },
      { name: "description", content: "Manage your restaurant page and menu on Bite." },
      { property: "og:title", content: "Restaurant dashboard — Bite" },
      { property: "og:description", content: "Manage your restaurant on Bite." },
    ],
  }),
  component: OwnerLayout,
});

export function useMyRestaurant() {
  const { userId } = Route.useRouteContext();
  return useQuery({
    queryKey: ["my-restaurant", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function OwnerLayout() {
  const { data: r } = useMyRestaurant();
  const tabs = [
    { to: "/owner", label: "Orders", icon: ShoppingBag },
    { to: "/owner/drops", label: "Drops", icon: Zap },
    { to: "/owner/stamps", label: "Stamps", icon: QrCode },
    { to: "/owner/menu", label: "Menu", icon: UtensilsCrossed },
    { to: "/owner/setup", label: "Details", icon: Store },
  ] as const;
  return (
    <div className="pb-24">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-5 pb-3 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="" className="size-8 rounded-lg" />
          <span className="font-display text-lg font-extrabold">bite</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-secondary-foreground">
            Business
          </span>
        </div>
        {r && (
          <Link
            to="/r/$slug"
            params={{ slug: r.slug }}
            className="flex h-10 items-center gap-1.5 rounded-full bg-primary-soft px-3 text-sm font-semibold text-primary"
          >
            <Eye className="size-4" /> Preview
          </Link>
        )}
      </header>
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t bg-sidebar/95 backdrop-blur-xl pb-safe">
        <ul className="grid grid-cols-5">
          {tabs.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: true }}
                className="flex h-16 flex-col items-center justify-center gap-1 text-muted-foreground data-[status=active]:text-primary"
              >
                <Icon className="size-[22px]" />
                <span className="text-[11px] font-semibold">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
