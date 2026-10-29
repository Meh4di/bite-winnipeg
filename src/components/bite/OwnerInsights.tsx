import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/bite";

const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Winnipeg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Winnipeg", weekday: "narrow" }).format(d);

export function OwnerInsights({ restaurantId }: { restaurantId: string }) {
  const q = useQuery({
    queryKey: ["owner-insights", restaurantId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [orders, stamps, rewards, follows] = await Promise.all([
        supabase
          .from("orders")
          .select("user_id, total_cents, created_at, drop_id, status")
          .eq("restaurant_id", restaurantId)
          .neq("status", "cancelled")
          .gte("created_at", since),
        supabase
          .from("stamps")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId)
          .gte("created_at", since),
        supabase
          .from("reward_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId)
          .gte("created_at", since),
        supabase
          .from("follows")
          .select("user_id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId),
      ]);
      if (orders.error) throw orders.error;
      const list = orders.data ?? [];
      const today = dayKey(new Date());
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() - (6 - i) * 86400_000);
        return { key: dayKey(d), label: dayLabel(d), cents: 0 };
      });
      const perUser = new Map<string, number>();
      for (const o of list) {
        const k = dayKey(new Date(o.created_at));
        const day = days.find((d) => d.key === k);
        if (day) day.cents += o.total_cents;
        perUser.set(o.user_id, (perUser.get(o.user_id) ?? 0) + 1);
      }
      const todays = list.filter((o) => dayKey(new Date(o.created_at)) === today);
      const sales30 = list.reduce((s, o) => s + o.total_cents, 0);
      const customers = perUser.size;
      const repeat = [...perUser.values()].filter((n) => n >= 2).length;
      return {
        todayOrders: todays.length,
        todaySales: todays.reduce((s, o) => s + o.total_cents, 0),
        days,
        avg: list.length ? Math.round(sales30 / list.length) : 0,
        sales30,
        customers,
        repeatPct: customers ? Math.round((repeat / customers) * 100) : 0,
        dropClaims: list.filter((o) => o.drop_id).length,
        stamps: stamps.count ?? 0,
        rewards: rewards.count ?? 0,
        followers: follows.count ?? 0,
      };
    },
  });

  const d = q.data;
  const max = Math.max(1, ...(d?.days.map((x) => x.cents) ?? [1]));

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <TrendingUp className="size-5 text-primary" /> Insights
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Tile
          value={d ? formatPrice(d.todaySales) : "–"}
          label={`Today · ${d?.todayOrders ?? 0} orders`}
        />
        <Tile value={d ? formatPrice(d.avg) : "–"} label="Avg order (30 days)" />
      </div>
      <div className="rounded-3xl bg-card p-4 shadow-card">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">Last 7 days</p>
          <p className="text-sm text-muted-foreground">
            {d ? formatPrice(d.days.reduce((s, x) => s + x.cents, 0)) : ""}
          </p>
        </div>
        <div
          className="mt-3 flex h-28 items-end gap-2"
          role="img"
          aria-label="Sales for the last 7 days"
        >
          {(
            d?.days ??
            Array.from({ length: 7 }, (_, i) => ({ key: String(i), label: "", cents: 0 }))
          ).map((x, i, arr) => (
            <div key={x.key} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-lg ${i === arr.length - 1 ? "bg-primary" : "bg-primary/35"}`}
                style={{ height: `${Math.max(4, (x.cents / max) * 96)}px` }}
                title={formatPrice(x.cents)}
              />
              <span className="text-[11px] font-semibold text-muted-foreground">{x.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Small value={d?.customers} label="Customers" />
        <Small value={d ? `${d.repeatPct}%` : undefined} label="Came back" />
        <Small value={d?.followers} label="Followers" />
        <Small value={d?.dropClaims} label="Drop claims" />
        <Small value={d?.stamps} label="Stamps" />
        <Small value={d?.rewards} label="Rewards" />
      </div>
      <p className="text-xs text-muted-foreground">
        Last 30 days unless noted. Payments are in test mode.
      </p>
    </section>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-card">
      <p className="font-display text-3xl font-extrabold text-primary">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
function Small({ value, label }: { value: number | string | undefined; label: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-card">
      <p className="font-display text-xl font-extrabold">{value ?? "–"}</p>
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}
