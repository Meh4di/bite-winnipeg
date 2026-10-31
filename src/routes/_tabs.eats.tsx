import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { HONEST_PROMISES, useValueItems } from "@/lib/eats";
import { ValueCard } from "@/components/bite/ValueCard";

type Filter = "10" | "15" | "small";

export const Route = createFileRoute("/_tabs/eats")({
  validateSearch: (s: Record<string, unknown>): { f?: Filter } =>
    s["f"] === "10" || s["f"] === "small" ? { f: s["f"] } : {},
  head: () => ({
    meta: [
      { title: "Eat well for less — Bity" },
      {
        name: "description",
        content:
          "Good food under $15 and small plates from local Winnipeg spots. The price you see is the price you pay.",
      },
      { property: "og:title", content: "Eat well for less in Winnipeg — Bity" },
      { property: "og:description", content: "Honest prices from local spots." },
    ],
  }),
  component: Eats,
});

const FILTERS: { key: Filter; label: string; sub: string }[] = [
  { key: "15", label: "Under $15", sub: "A real meal without the $25 lunch" },
  { key: "10", label: "Under $10", sub: "Snacks, coffee and cheap eats" },
  { key: "small", label: "🥗 Small plates", sub: "Lighter portions at lighter prices" },
];

function Eats() {
  const { f = "15" } = Route.useSearch();
  const items = useValueItems(1500);
  const list = (items.data ?? []).filter((i) =>
    f === "10" ? i.price_cents <= 1000 : f === "small" ? i.is_small_plate : true,
  );
  const active = FILTERS.find((x) => x.key === f)!;

  return (
    <div className="animate-screen px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Home
      </Link>
      <h1 className="mt-2 text-[2rem] font-extrabold leading-tight">Eat well for less</h1>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {HONEST_PROMISES.map((p) => (
          <span
            key={p.text}
            className="rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-bold text-success"
          >
            {p.emoji} {p.text}
          </span>
        ))}
      </div>

      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            to="/eats"
            search={x.key === "15" ? {} : { f: x.key }}
            replace
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold leading-10 ${
              f === x.key ? "bg-foreground text-background" : "bg-secondary"
            }`}
          >
            {x.label}
          </Link>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{active.sub}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 pb-6">
        {items.isLoading &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-secondary" />
          ))}
        {list.map((i) => (
          <ValueCard key={i.id} item={i} />
        ))}
      </div>
      {!items.isLoading && list.length === 0 && (
        <div className="rounded-3xl bg-card p-8 text-center shadow-card">
          <p className="text-5xl">🥗</p>
          <p className="mt-3 font-bold">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            As spots add small plates and value meals, they'll show up here.
          </p>
        </div>
      )}
    </div>
  );
}
