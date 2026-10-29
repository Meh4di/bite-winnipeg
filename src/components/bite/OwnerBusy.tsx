import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BUSY, liveBusy, minutesAgo, type BusyLevel } from "@/lib/community";
import { useNow } from "@/lib/live";

const WAITS = [0, 10, 20, 30, 45, 60];

export function OwnerBusy({
  restaurant,
}: {
  restaurant: {
    id: string;
    busy_level: string | null;
    wait_minutes: number | null;
    busy_updated_at: string | null;
  };
}) {
  const qc = useQueryClient();
  const now = useNow(30_000);
  const [saving, setSaving] = useState(false);
  const live = liveBusy(restaurant, now);

  const set = async (patch: { busy_level?: BusyLevel | null; wait_minutes?: number | null }) => {
    setSaving(true);
    const { error } = await supabase
      .from("restaurants")
      .update({
        busy_level: patch.busy_level !== undefined ? patch.busy_level : (live?.level ?? null),
        wait_minutes: patch.wait_minutes !== undefined ? patch.wait_minutes : (live?.wait ?? null),
      })
      .eq("id", restaurant.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-restaurant"] });
    qc.invalidateQueries({ queryKey: ["restaurant"] });
    qc.invalidateQueries({ queryKey: ["restaurants"] });
  };

  return (
    <section className="rounded-3xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">
          <Activity className="size-5 text-primary" /> How busy is it?
        </h2>
        <span className="text-xs text-muted-foreground">
          {live?.updatedAt ? `Updated ${minutesAgo(live.updatedAt, now)}` : "Not showing"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Shows on your page and the map for 2 hours, then hides so it's never out of date.
      </p>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {(Object.keys(BUSY) as BusyLevel[]).map((k) => {
          const on = live?.level === k;
          return (
            <button
              key={k}
              disabled={saving}
              onClick={() => set({ busy_level: k })}
              aria-pressed={on}
              className={`flex h-14 flex-col items-center justify-center rounded-xl text-xs font-bold transition-all active:scale-95 ${
                on ? `${BUSY[k].pill} shadow-card` : "bg-muted text-foreground"
              }`}
            >
              <span className="text-base">{BUSY[k].emoji}</span>
              {BUSY[k].label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Wait for a table / walk-in
      </p>
      <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto">
        {WAITS.map((w) => {
          const on = live?.wait === w;
          return (
            <button
              key={w}
              disabled={saving}
              onClick={() => set({ wait_minutes: w })}
              aria-pressed={on}
              className={`h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {w === 0 ? "No wait" : w === 60 ? "60+ min" : `${w} min`}
            </button>
          );
        })}
        {live && (
          <button
            disabled={saving}
            onClick={() => set({ busy_level: null, wait_minutes: null })}
            className="h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold text-muted-foreground"
          >
            Clear
          </button>
        )}
      </div>
    </section>
  );
}

export function FreeBanner({ freeUntil }: { freeUntil: string | null }) {
  if (!freeUntil) return null;
  const end = new Date(freeUntil);
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days <= 0) return null;
  return (
    <section className="rounded-3xl bg-warm p-4 text-primary-foreground shadow-pop">
      <p className="text-xs font-bold uppercase tracking-wider opacity-90">🍁 Founding partner</p>
      <p className="mt-1 text-lg font-extrabold leading-tight">
        Bite is free for you until{" "}
        {end.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
      </p>
      <p className="mt-1 text-sm opacity-90">
        No fees on pickup orders, drops, last-call deals or promotions. {days}{" "}
        {days === 1 ? "day" : "days"} left.
      </p>
    </section>
  );
}
