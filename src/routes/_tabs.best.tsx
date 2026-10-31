import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Star } from "lucide-react";
import { formatPrice } from "@/lib/bite";
import { DISH_TYPES, dishEmoji, useDishLeaderboard } from "@/lib/dishes";

export const Route = createFileRoute("/_tabs/best")({
  validateSearch: (s: Record<string, unknown>): { dish?: string } =>
    typeof s["dish"] === "string" ? { dish: s["dish"] } : {},
  head: () => ({
    meta: [
      { title: "Best in the Peg — Bity" },
      {
        name: "description",
        content:
          "Winnipeg's top-rated dishes, ranked by real customers. Best lattes, tacos, ramen and more.",
      },
      { property: "og:title", content: "Best in the Peg — Bity" },
      { property: "og:description", content: "Winnipeg's best dishes, ranked by locals." },
    ],
  }),
  component: Best,
});

function Best() {
  const { dish } = Route.useSearch();
  const board = useDishLeaderboard();
  const types = useMemo(() => {
    const present = new Set((board.data?.rows ?? []).map((r) => r.dish_type));
    return DISH_TYPES.filter((d) => present.has(d.key));
  }, [board.data]);
  const [type, setType] = useState<string | null>(dish ?? null);
  const active = type ?? types[0]?.key ?? null;
  const rows = (board.data?.rows ?? []).filter((r) => r.dish_type === active).slice(0, 10);

  return (
    <div className="animate-screen px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Home
      </Link>
      <h1 className="text-[2rem] font-extrabold leading-tight">🏆 Best in the Peg</h1>
      <p className="text-sm text-muted-foreground">
        Winnipeg's top dishes, ranked by people who actually ate them.
      </p>

      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {types.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${
              active === t.key ? "bg-foreground text-background" : "bg-secondary"
            }`}
          >
            {t.emoji} {t.key}
          </button>
        ))}
      </div>

      <ol className="mt-5 space-y-3">
        {board.isLoading && <div className="h-40 animate-pulse rounded-2xl bg-muted" />}
        {rows.map((r, i) => (
          <li key={r.menu_item_id}>
            <Link
              to="/r/$slug"
              params={{ slug: r.restaurant_slug }}
              className={`flex items-center gap-3 rounded-2xl p-3 active:scale-[0.99] ${i === 0 ? "bg-amber-50 ring-2 ring-amber-300 dark:bg-amber-950/30" : "bg-card shadow-card"}`}
            >
              <span className="w-8 shrink-0 text-center text-2xl font-extrabold">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </span>
              {r.photo_url ? (
                <img
                  src={r.photo_url}
                  alt=""
                  loading="lazy"
                  className="size-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-muted text-3xl">
                  {dishEmoji(r.dish_type)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {r.restaurant_name} · {r.neighbourhood}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
                  <Star className="size-4 fill-amber-400 text-amber-400" />{" "}
                  {r.avg_rating.toFixed(1)}
                  <span className="font-normal text-muted-foreground">
                    ({r.rating_count}) · {formatPrice(r.price_cents)}
                  </span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
      {!board.isLoading && !rows.length && (
        <div className="rounded-2xl bg-card p-8 text-center shadow-card">
          <p className="text-5xl">🏆</p>
          <p className="mt-3 font-bold">No rankings yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Rate dishes on any restaurant page after you visit to start the leaderboard.
          </p>
        </div>
      )}
    </div>
  );
}
