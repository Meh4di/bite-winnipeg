import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Footprints, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { emojiFor } from "@/lib/bite";
import { routeLink, useCrawls, useStampedSpots } from "@/lib/crawls";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_tabs/crawls_/$slug")({
  head: () => ({
    meta: [
      { title: "Food crawl — Bity" },
      { name: "description", content: "A Winnipeg food crawl on Bity." },
      { property: "og:title", content: "Food crawl — Bity" },
      { property: "og:description", content: "A Winnipeg food crawl on Bity." },
    ],
  }),
  component: CrawlPage,
});

function CrawlPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const crawls = useCrawls();
  const stamped = useStampedSpots(user?.id);
  const c = crawls.data?.find((x) => x.slug === slug);

  if (crawls.isLoading) return <div className="m-5 h-72 animate-pulse rounded-2xl bg-muted" />;
  if (!c)
    return (
      <div className="p-10 text-center">
        <p className="text-5xl">🗺️</p>
        <p className="mt-3 font-semibold">Crawl not found</p>
        <Link to="/crawls" className="mt-3 inline-block font-semibold text-primary">
          All crawls
        </Link>
      </div>
    );

  const done = c.crawl_stops.filter((s) => stamped.data?.has(s.restaurant_id)).length;
  const total = c.crawl_stops.length;
  const complete = total > 0 && done === total;
  const route = routeLink(c);

  return (
    <div className="animate-screen">
      <div className="relative aspect-[4/3] bg-muted">
        {c.cover_url && <img src={c.cover_url} alt="" className="size-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        <Link
          to="/crawls"
          aria-label="Back"
          className="absolute left-4 top-[max(env(safe-area-inset-top),1rem)] grid size-11 place-items-center rounded-full bg-card shadow-card"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </div>
      <div className="relative -mt-16 px-5">
        <p className="text-5xl">{c.emoji}</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">{c.title}</h1>
        {c.description && (
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{c.description}</p>
        )}

        <div className={`mt-4 rounded-2xl p-4 ${complete ? "bg-success/15" : "bg-secondary"}`}>
          <div className="flex items-center justify-between text-sm font-bold">
            <span>{complete ? "🏁 Crawl complete!" : `${done} of ${total} stops`}</span>
            {c.reward && <span className="text-muted-foreground">🎁 {c.reward}</span>}
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-card">
            <div
              className={`h-full rounded-full ${complete ? "bg-success" : "bg-primary"}`}
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {complete
              ? "Show this screen at your last stop to claim the reward. You also earned the Crawl Champ badge."
              : "Collect a stamp at each stop: order, grab a drop, or scan the counter code."}
          </p>
        </div>

        {route && (
          <Button asChild size="xl" variant="secondary" className="mt-3 w-full">
            <a href={route} target="_blank" rel="noreferrer">
              <Footprints className="size-5" /> Walking route
            </a>
          </Button>
        )}

        <ol className="relative mt-6 space-y-4 border-l-2 border-dashed border-border pl-6">
          {c.crawl_stops.map((s, i) => {
            const got = stamped.data?.has(s.restaurant_id);
            return (
              <li key={s.restaurant_id} className="relative">
                <span
                  className={`absolute -left-[2.3rem] top-3 grid size-8 place-items-center rounded-full text-sm font-extrabold ${
                    got
                      ? "bg-success text-success-foreground"
                      : "bg-card text-foreground shadow-card"
                  }`}
                >
                  {got ? <Check className="size-4" /> : i + 1}
                </span>
                {s.restaurants && (
                  <Link
                    to="/r/$slug"
                    params={{ slug: s.restaurants.slug }}
                    className="flex gap-3 rounded-2xl bg-card p-3 shadow-card active:scale-[0.99]"
                  >
                    {s.restaurants.cover_url ? (
                      <img
                        src={s.restaurants.cover_url}
                        alt=""
                        loading="lazy"
                        className="size-16 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-muted text-2xl">
                        {emojiFor(s.restaurants.category)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{s.restaurants.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {s.restaurants.neighbourhood}
                      </p>
                      {s.tip && <p className="mt-1 text-sm">💡 {s.tip}</p>}
                    </div>
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
