import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
] as const;

/** "Bity sent you…": verified visits are proof someone came in; views and directions are interest. */
export function OwnerTraffic({ restaurantId }: { restaurantId: string }) {
  const [days, setDays] = useState<7 | 30>(30);
  const report = useQuery({
    queryKey: ["owner-report", restaurantId, days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_report", {
        p_restaurant_id: restaurantId,
        p_days: days,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const r = report.data;
  const verified = (r?.verified_visits ?? 0) + (r?.pickups ?? 0) + (r?.redemptions ?? 0);

  return (
    <section className="rounded-3xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Bity sent you</h2>
        <div className="flex gap-1 rounded-full bg-secondary p-0.5">
          {RANGES.map((x) => (
            <button
              key={x.days}
              onClick={() => setDays(x.days)}
              className={`h-7 rounded-full px-2.5 text-xs font-bold ${
                days === x.days ? "bg-card shadow-card" : "text-muted-foreground"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      {r?.best_rank && (
        <p className="mt-3 rounded-2xl bg-primary-soft px-3 py-2 text-sm font-bold text-primary">
          🏆 You're {r.best_rank.replaceAll("-", " ")} in Winnipeg on the Bity Map
        </p>
      )}

      <div className="mt-3 rounded-2xl bg-success/10 p-3">
        <p className="text-3xl font-extrabold text-success">{report.isLoading ? "–" : verified}</p>
        <p className="text-sm font-semibold">verified visits</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {r?.verified_visits ?? 0} counter stamps · {r?.pickups ?? 0} pickups ·{" "}
          {r?.redemptions ?? 0} deals redeemed
        </p>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["Page views", r?.views],
            ["Directions", r?.directions],
            ["New followers", r?.new_followers],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="rounded-2xl bg-secondary py-2.5">
            <p className="text-xl font-extrabold">{n ?? "–"}</p>
            <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Verified visits are people who scanned your counter code, picked up an order or redeemed a
        deal. Views and directions show interest from Bity users. Bity never tracks anyone's
        location.
      </p>
    </section>
  );
}
