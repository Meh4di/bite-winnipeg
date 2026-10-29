import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCrawls, useStampedSpots } from "@/lib/crawls";

export const Route = createFileRoute("/_tabs/crawls")({
  head: () => ({
    meta: [
      { title: "Food crawls — Bite" },
      {
        name: "description",
        content: "Curated Winnipeg food crawls. Visit every stop, collect stamps, earn rewards.",
      },
      { property: "og:title", content: "Food crawls — Bite" },
      { property: "og:description", content: "Winnipeg food crawls and quests." },
    ],
  }),
  component: Crawls,
});

function Crawls() {
  const { user } = useAuth();
  const crawls = useCrawls();
  const stamped = useStampedSpots(user?.id);

  return (
    <div className="animate-screen px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Home
      </Link>
      <h1 className="text-[2rem] font-extrabold leading-tight">Food crawls</h1>
      <p className="text-sm text-muted-foreground">
        Hit every stop, collect a stamp at each, and earn the reward.
      </p>
      <div className="mt-5 space-y-4">
        {crawls.isLoading && <div className="h-56 animate-pulse rounded-2xl bg-muted" />}
        {crawls.data?.map((c) => {
          const done = c.crawl_stops.filter((s) => stamped.data?.has(s.restaurant_id)).length;
          const total = c.crawl_stops.length;
          return (
            <Link
              key={c.id}
              to="/crawls/$slug"
              params={{ slug: c.slug }}
              className="block active:scale-[0.99]"
            >
              <div className="relative aspect-[16/8] overflow-hidden rounded-2xl bg-muted">
                {c.cover_url && (
                  <img src={c.cover_url} alt="" loading="lazy" className="size-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-card px-2.5 py-1 text-xs font-bold">
                  {total} stops{done ? ` · ${done}/${total} done` : ""}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="text-2xl font-extrabold leading-tight">
                    {c.emoji} {c.title}
                  </p>
                  {c.reward && <p className="mt-0.5 text-sm opacity-90">🎁 {c.reward}</p>}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                  />
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          );
        })}
        {!crawls.isLoading && !crawls.data?.length && (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
            New crawls are coming soon.
          </p>
        )}
      </div>
    </div>
  );
}
