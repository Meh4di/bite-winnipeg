import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DropCard } from "@/components/bite/DropCard";
import { PromoCard } from "@/components/bite/PromoCard";
import { dropState, useDrops, useNow, usePromotions } from "@/lib/live";

export const Route = createFileRoute("/_tabs/drops")({
  head: () => ({
    meta: [
      { title: "Drops — Bite" },
      {
        name: "description",
        content: "Limited food drops, last-call deals and promos from Winnipeg spots.",
      },
      { property: "og:title", content: "Drops — Bite" },
      { property: "og:description", content: "Limited-quantity food drops from Winnipeg spots." },
    ],
  }),
  component: Drops,
});

const SEGMENTS = [
  { key: "drops", label: "🔥 Drops" },
  { key: "leftover", label: "🥡 Last call" },
  { key: "deals", label: "📣 Deals" },
] as const;

function Drops() {
  const [seg, setSeg] = useState<(typeof SEGMENTS)[number]["key"]>("drops");
  const now = useNow(1000);
  const drops = useDrops();
  const promos = usePromotions();

  const kind = seg === "leftover" ? "leftover" : "drop";
  const list = (drops.data ?? []).filter((d) => d.kind === kind);
  const live = list.filter((d) => dropState(d, now) === "live");
  const upcoming = list.filter((d) => dropState(d, now) === "upcoming");
  const gone = list.filter((d) => ["soldout", "ended"].includes(dropState(d, now)));
  const count = (k: string) =>
    k === "deals"
      ? (promos.data?.length ?? 0)
      : (drops.data ?? []).filter(
          (d) =>
            d.kind === (k === "leftover" ? "leftover" : "drop") && dropState(d, now) === "live",
        ).length;

  return (
    <div className="animate-screen px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <h1 className="text-[2rem] font-extrabold leading-tight">Drops</h1>
      <p className="text-sm text-muted-foreground">
        Limited runs, last-call deals and promos. First come, first served.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1" role="tablist">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={seg === s.key}
            onClick={() => setSeg(s.key)}
            className={`relative h-11 rounded-xl text-sm font-bold transition-all ${
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

      {seg === "deals" ? (
        <div className="mt-5 space-y-4">
          {promos.isLoading && <div className="h-48 animate-pulse rounded-3xl bg-muted" />}
          {promos.data?.map((p) => (
            <PromoCard key={p.id} p={p} />
          ))}
          {!promos.isLoading && !promos.data?.length && (
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
              title={seg === "leftover" ? "No last-call deals right now" : "No drops right now"}
              line={
                seg === "leftover"
                  ? "Spots post end-of-day food here at a discount. Check back near closing time."
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
