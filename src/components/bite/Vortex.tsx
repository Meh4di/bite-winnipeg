import { Link } from "@tanstack/react-router";
import { Lock, Snowflake } from "lucide-react";
import { useVortex, VORTEX_AT_C } from "@/lib/weather";
import { usePromotions, type PromoRow } from "@/lib/live";
import { PromoCard } from "@/components/bite/PromoCard";

/** Vortex promos split into unlocked (cold enough) and still-locked. */
export function useVortexDeals() {
  const vortex = useVortex();
  const promos = usePromotions();
  const all = (promos.data ?? []).filter((p) => p.vortex_only);
  const unlocked = all.filter(
    (p) => vortex.feelsLike !== null && vortex.feelsLike <= p.unlock_temp_c,
  );
  const locked = all.filter((p) => !unlocked.includes(p));
  return { vortex, unlocked, locked, all };
}

export function VortexBanner({ compact = false }: { compact?: boolean }) {
  const { vortex, unlocked, locked } = useVortexDeals();
  const temp = vortex.feelsLike;

  if (vortex.active)
    return (
      <Link
        to="/drops"
        search={{ tab: "vortex" }}
        className="relative block overflow-hidden rounded-2xl bg-warm p-4 text-primary-foreground shadow-pop active:scale-[0.99]"
      >
        <div className="snow" aria-hidden />
        <p className="relative text-xs font-extrabold uppercase tracking-widest opacity-90">
          {vortex.preview ? "Preview · " : ""}Polar Vortex mode
        </p>
        <p className="relative mt-1 text-2xl font-extrabold leading-tight">
          Feels like {temp}°C. Warm-up deals are on. 🥶
        </p>
        <p className="relative mt-1 text-sm opacity-90">
          {unlocked.length
            ? `${unlocked.length} vortex ${unlocked.length === 1 ? "deal" : "deals"} unlocked${locked.length ? ` · ${locked.length} more if it gets colder` : ""}`
            : "Spots are firing up soup and hot chocolate. The colder it gets, the bigger the deals."}
        </p>
      </Link>
    );

  if (compact || (!locked.length && temp === null)) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-sky-600">
        <Snowflake className="size-5" />
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <b>Polar Vortex deals</b> unlock at {VORTEX_AT_C}°C
        {temp !== null ? ` · feels like ${temp}°C now` : ""}
        {locked.length ? ` · ${locked.length} waiting` : ""}
      </p>
    </div>
  );
}

export function VortexDealsList() {
  const { vortex, unlocked, locked } = useVortexDeals();
  return (
    <div className="space-y-4">
      <VortexBanner />
      {unlocked.map((p) => (
        <PromoCard key={p.id} p={p} />
      ))}
      {locked.map((p) => (
        <LockedVortex key={p.id} p={p} feelsLike={vortex.feelsLike} />
      ))}
      {!unlocked.length && !locked.length && (
        <div className="rounded-2xl bg-card p-8 text-center shadow-card">
          <p className="text-5xl">🥶</p>
          <p className="mt-3 font-bold">No vortex deals posted yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When Winnipeg drops to {VORTEX_AT_C}°C, spots unlock warm-up deals here. The colder it
            gets, the bigger they get.
          </p>
        </div>
      )}
    </div>
  );
}

function LockedVortex({ p, feelsLike }: { p: PromoRow; feelsLike: number | null }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 p-4 dark:bg-sky-950/30">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900">
          <Lock className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            Unlocks at {p.unlock_temp_c}°C{feelsLike !== null ? ` · now ${feelsLike}°C` : ""}
          </p>
          <p className="truncate font-bold">{p.restaurants?.name}</p>
          <p className="text-sm text-muted-foreground blur-[3px] select-none" aria-hidden>
            {p.title}
          </p>
        </div>
      </div>
    </div>
  );
}
