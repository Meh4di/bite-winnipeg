import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { EVENT_CATEGORIES, isThisWeekend, isToday, useEvents, type BityEvent } from "@/lib/events";
import { EventCard } from "@/components/bite/EventCard";

type When = "all" | "today" | "weekend" | "free" | "friends";
type Search = { when?: When | undefined; cat?: string | undefined; tag?: string | undefined };

const WHENS: { key: When; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "weekend", label: "This weekend" },
  { key: "free", label: "Free" },
  { key: "friends", label: "👯 Friends going" },
];

export const Route = createFileRoute("/_tabs/events")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof s["when"] === "string" && WHENS.some((w) => w.key === s["when"]))
      out.when = s["when"] as When;
    if (typeof s["cat"] === "string" && EVENT_CATEGORIES.some((c) => c.key === s["cat"]))
      out.cat = s["cat"];
    if (typeof s["tag"] === "string") out.tag = s["tag"].slice(0, 30);
    return out;
  },
  head: () => ({
    meta: [
      { title: "What's on in Winnipeg — Bity" },
      {
        name: "description",
        content:
          "Games, concerts, festivals, markets, pop-ups and restaurant nights in Winnipeg. See which friends are going and where to eat nearby.",
      },
      { property: "og:title", content: "What's on in Winnipeg — Bity" },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const { when = "all", cat, tag } = Route.useSearch();
  const navigate = useNavigate({ from: "/events" });
  const q = useEvents();
  const set = (patch: Partial<Search>) =>
    navigate({ search: (s: Search) => ({ ...s, ...patch }), replace: true });

  const list = useMemo(() => {
    let l: BityEvent[] = q.data ?? [];
    if (when === "today") l = l.filter((e) => isToday(e));
    if (when === "weekend") l = l.filter((e) => isThisWeekend(e));
    if (when === "free") l = l.filter((e) => e.is_free);
    if (when === "friends") l = l.filter((e) => e.stats.friends_going > 0);
    if (cat) l = l.filter((e) => e.category === cat);
    if (tag) l = l.filter((e) => e.tags.includes(tag));
    return l;
  }, [q.data, when, cat, tag]);

  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3.5 py-2 text-sm font-bold transition-colors ${on ? "bg-foreground text-background" : "bg-card shadow-card"}`;

  return (
    <div className="animate-screen space-y-4 px-5 pb-6 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight">What's on</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything happening in Winnipeg, who's going, and where to eat nearby.
          </p>
        </div>
        <Link
          to="/events/new"
          className="mt-1 flex shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" /> Post
        </Link>
      </header>

      <button
        onClick={() => set({ tag: tag === "newcomer-friendly" ? undefined : "newcomer-friendly" })}
        className={`flex w-full items-center gap-3 rounded-3xl p-4 text-left ${tag === "newcomer-friendly" ? "bg-primary text-primary-foreground" : "bg-primary-soft"}`}
      >
        <span className="text-3xl">👋</span>
        <span>
          <span className="block font-extrabold">New to Winnipeg?</span>
          <span className="block text-sm opacity-80">
            {tag === "newcomer-friendly"
              ? "Showing newcomer-friendly events. Tap to see everything."
              : "Find newcomer-friendly events, festivals and places to meet people."}
          </span>
        </span>
      </button>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
        {WHENS.map((w) => (
          <button
            key={w.key}
            className={chip(when === w.key)}
            onClick={() => set({ when: w.key === "all" ? undefined : w.key })}
          >
            {w.label}
          </button>
        ))}
      </div>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
        {EVENT_CATEGORIES.filter((c) => c.key !== "other").map((c) => (
          <button
            key={c.key}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${cat === c.key ? "border-primary bg-primary-soft text-primary" : "border-border"}`}
            onClick={() => set({ cat: cat === c.key ? undefined : c.key })}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-60 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-center shadow-card">
          <p className="text-4xl">📅</p>
          <p className="mt-2 font-extrabold">
            {when === "friends" ? "No friends going to anything yet" : "Nothing here yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {when === "friends"
              ? "Tap Going on an event and your friends will see it too."
              : "Know about something happening? Post it and help people find it."}
          </p>
          <Link
            to="/events/new"
            className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Post an event
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {list.map((e) => (
            <EventCard key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}
