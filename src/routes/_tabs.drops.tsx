import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VortexDealsList, useVortexDeals } from "@/components/bite/Vortex";
import { useState } from "react";
import { DropCard } from "@/components/bite/DropCard";
import { PromoCard } from "@/components/bite/PromoCard";
import { dropState, useDrops, useNow, usePromotions } from "@/lib/live";
import { unlockState, useUnlockDeals } from "@/lib/unlock";
import { UnlockCard } from "@/components/bite/UnlockCard";

type Seg = "drops" | "unlock" | "leftover" | "deals" | "vortex";

export const Route = createFileRoute("/_tabs/drops")({
  validateSearch: (s: Record<string, unknown>): { tab?: Seg } => {
    const t = s["tab"];
    return t === "drops" || t === "unlock" || t === "leftover" || t === "deals" || t === "vortex"
      ? { tab: t }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Drops — Bity" },
      {
        name: "description",
        content: "Limited food drops, last-call deals and promos from Winnipeg spots.",
      },
      { property: "og:title", content: "Drops — Bity" },
      { property: "og:description", content: "Limited-quantity food drops from Winnipeg spots." },
    ],
  }),
  component: Drops,
});

const SEGMENTS: { key: Seg; label: string }[] = [
  { key: "drops", label: "🔥 Drops" },
  { key: "unlock", label: "🔓 Unlock" },
  { key: "leftover", label: "♻️ Save" },
  { key: "deals", label: "📣 Deals" },
  { key: "vortex", label: "🥶 Vortex" },
];

function Drops() {
  const { tab } = Route.useSearch();
  const now = useNow(1000);
  const drops = useDrops();
  const promos = usePromotions();
  const [seg, setSeg] = useState<Seg>(tab ?? "drops");
  const vortexDeals = useVortexDeals();
  const impact = useQuery({
    queryKey: ["city-impact"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("city_impact");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const deals = (promos.data ?? []).filter((p) => !p.vortex_only);
  const unlocks = useUnlockDeals();
  const unlockLive = (unlocks.data ?? []).filter((d) =>
    ["open", "unlocked"].includes(unlockState(d, now)),
  );
  const unlockDone = (unlocks.data ?? []).filter(
    (d) => !["open", "unlocked", "cancelled"].includes(unlockState(d, now)),
  );

  const kind = seg === "leftover" ? "leftover" : "drop";
  const list = (drops.data ?? []).filter((d) => d.kind === kind);
  const live = list.filter((d) => dropState(d, now) === "live");
  const upcoming = list.filter((d) => dropState(d, now) === "upcoming");
  const gone = list.filter((d) => ["soldout", "ended"].includes(dropState(d, now)));
  const count = (k: string) =>
    k === "deals"
      ? deals.length
      : k === "unlock"
        ? unlockLive.length
        : k === "vortex"
          ? vortexDeals.unlocked.length
          : (drops.data ?? []).filter(
              (d) =>
                d.kind === (k === "leftover" ? "leftover" : "drop") && dropState(d, now) === "live",
            ).length;

  return (
    <div className="animate-screen px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <h1 className="text-[2rem] font-extrabold leading-tight">Drops</h1>
      <p className="text-sm text-muted-foreground">
        Limited runs, food rescue deals, promos and cold-weather specials.
      </p>

      <div className="mt-4 grid grid-cols-5 gap-1 rounded-2xl bg-muted p-1" role="tablist">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={seg === s.key}
            onClick={() => setSeg(s.key)}
            className={`relative h-11 rounded-xl text-[12px] font-bold transition-all ${
              seg === s.key ? "bg-card text-foreground shadow-card" : "text-muted-foreground"
            }`}
          >
            {s.label}
            {count(s.key) > 0 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {count(s.key)}
              </span>
            )}
          </button>
        ))}
      </div>

      {seg === "leftover" &&
        impact.data &&
        impact.data.meals_rescued + impact.data.meals_donated > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-success/10 p-3 text-center text-success">
            <div>
              <p className="text-xl font-extrabold">{impact.data.meals_rescued}</p>
              <p className="text-[11px] font-semibold">meals rescued</p>
            </div>
            <div>
              <p className="text-xl font-extrabold">{impact.data.meals_donated}</p>
              <p className="text-[11px] font-semibold">donated</p>
            </div>
            <div>
              <p className="text-xl font-extrabold">{impact.data.meals_paid_forward}</p>
              <p className="text-[11px] font-semibold">paid forward</p>
            </div>
          </div>
        )}

      {seg === "unlock" ? (
        <div className="mt-5 space-y-6">
          <div className="rounded-3xl bg-foreground p-4 text-background">
            <p className="font-extrabold">🔓 Unlock deals</p>
            <p className="mt-1 text-sm opacity-80">
              Big discounts that switch on when enough people join. Joining is free, and if the goal
              isn't reached, nobody pays.
            </p>
          </div>
          {unlocks.isLoading && <div className="h-72 animate-pulse rounded-3xl bg-muted" />}
          {unlockLive.length > 0 && (
            <Section title="Join now">
              {unlockLive.map((d) => (
                <UnlockCard key={d.id} deal={d} now={now} wide />
              ))}
            </Section>
          )}
          {unlockDone.length > 0 && (
            <Section title="Recently closed">
              {unlockDone.map((d) => (
                <UnlockCard key={d.id} deal={d} now={now} wide />
              ))}
            </Section>
          )}
          {!unlocks.isLoading && !unlockLive.length && !unlockDone.length && (
            <Empty
              emoji="🔓"
              title="No unlock deals right now"
              line="Restaurants post these for slow nights. Check back soon."
            />
          )}
        </div>
      ) : seg === "vortex" ? (
        <div className="mt-5">
          <VortexDealsList />
        </div>
      ) : seg === "deals" ? (
        <div className="mt-5 space-y-4">
          {promos.isLoading && <div className="h-48 animate-pulse rounded-3xl bg-muted" />}
          {deals.map((p) => (
            <PromoCard key={p.id} p={p} />
          ))}
          {!promos.isLoading && !deals.length && (
            <Empty
              emoji="📣"
              title="No deals running"
              line="When spots post promos, they'll show up here."
            />
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {drops.isLoading && <div className="h-72 animate-pulse rounded-3xl bg-muted" />}
          {live.length > 0 && (
            <Section title="Live now">
              {live.map((d) => (
                <DropCard key={d.id} d={d} now={now} />
              ))}
            </Section>
          )}
          {upcoming.length > 0 && (
            <Section title="Coming up">
              {upcoming.map((d) => (
                <DropCard key={d.id} d={d} now={now} />
              ))}
            </Section>
          )}
          {gone.length > 0 && (
            <Section title="Just missed">
              {gone.map((d) => (
                <DropCard key={d.id} d={d} now={now} />
              ))}
            </Section>
          )}
          {!drops.isLoading && list.length === 0 && (
            <Empty
              emoji={seg === "leftover" ? "🥡" : "⏰"}
              title={seg === "leftover" ? "No food to save right now" : "No drops right now"}
              line={
                seg === "leftover"
                  ? "Near closing, spots post food that would be thrown out at 60–70% off. Check back later today."
                  : "Follow your favourite spots and check back. Drops sell out fast."
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Empty({ emoji, title, line }: { emoji: string; title: string; line: string }) {
  return (
    <div className="rounded-3xl bg-card p-8 text-center shadow-card">
      <p className="text-5xl">{emoji}</p>
      <p className="mt-3 font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{line}</p>
    </div>
  );
}
