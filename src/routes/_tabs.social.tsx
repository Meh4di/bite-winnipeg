import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarClock, Flame, Plus, ShieldCheck, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  feedLine,
  firstName,
  isAdultDate,
  matchTone,
  rulesAccepted,
  timeAgo,
  useBadges,
  useFeed,
  useMatches,
  useMeetups,
  useMySocial,
  usePeople,
  useSpots,
  type FeedItem,
  type Person,
} from "@/lib/social";
import {
  BirthdayGate,
  FollowButton,
  PersonAvatar,
  TableRulesDialog,
} from "@/components/bite/Social";
import { emojiFor } from "@/lib/bite";

type Tab = "feed" | "tables" | "match";

export const Route = createFileRoute("/_tabs/social")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    s["tab"] === "tables" || s["tab"] === "match" ? { tab: s["tab"] } : {},
  head: () => ({
    meta: [
      { title: "Social — Bity" },
      {
        name: "description",
        content:
          "See where your friends eat, find people with your taste, and plan meals with friends at Winnipeg restaurants.",
      },
      { property: "og:title", content: "Social — Bity" },
      {
        property: "og:description",
        content: "See where your friends eat and plan meals together.",
      },
    ],
  }),
  component: Social,
});

const SEGMENTS: { key: Tab; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "tables", label: "Tables" },
  { key: "match", label: "Match" },
];

function Social() {
  const { user, loading } = useAuth();
  const { tab = "feed" } = Route.useSearch();
  const navigate = useNavigate();

  if (!loading && !user) return <SignedOut />;

  return (
    <div className="animate-screen pt-[max(env(safe-area-inset-top),1.25rem)]">
      <header className="px-5">
        <h1 className="text-[32px] font-extrabold leading-none tracking-tight">Social</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          See where your friends eat and plan meals together.
        </p>
      </header>

      <div className="mt-4 px-5">
        <Link
          to="/decide"
          className="flex items-center gap-3 rounded-2xl bg-secondary p-4 shadow-card"
        >
          <span className="text-4xl">🎲</span>
          <span>
            <span className="block font-extrabold leading-tight">Can't decide where to eat?</span>
            <span className="block text-xs text-muted-foreground">
              Spin the wheel or swipe on spots with friends
            </span>
          </span>
        </Link>
      </div>

      <div
        className="sticky top-0 z-20 mt-4 bg-background/95 px-5 py-2 backdrop-blur"
        role="tablist"
      >
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={tab === s.key}
              onClick={() =>
                navigate({
                  to: "/social",
                  search: s.key === "feed" ? {} : { tab: s.key },
                  replace: true,
                })
              }
              className={`h-10 rounded-xl text-sm font-bold transition ${
                tab === s.key ? "bg-card shadow-card" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {user && (
        <div className="px-5 pb-6 pt-3">
          {tab === "feed" && <Feed me={user.id} />}
          {tab === "tables" && <Tables me={user.id} />}
          {tab === "match" && <Match me={user.id} />}
        </div>
      )}
    </div>
  );
}

function SignedOut() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-8 text-center animate-screen">
      <div className="text-6xl">🍽️</div>
      <h1 className="mt-4 text-3xl font-extrabold">Eat with your people</h1>
      <p className="mt-2 text-muted-foreground">
        Find foodies with your taste, see where friends eat, and plan meals with friends.
      </p>
      <Button asChild size="xl" className="mt-6 w-full">
        <Link to="/auth" search={{ redirect: "/social" }}>
          Sign in to join
        </Link>
      </Button>
    </div>
  );
}

/* ---------------- Feed ---------------- */

function Feed({ me }: { me: string }) {
  const qc = useQueryClient();
  const feed = useFeed(me);
  const spots = useSpots();
  const badges = useBadges();
  const people = usePeople((feed.data ?? []).map((a) => a.user_id));
  const spotById = useMemo(() => new Map((spots.data ?? []).map((s) => [s.id, s])), [spots.data]);

  const fire = async (a: FeedItem) => {
    const { error } = a.mine
      ? await supabase.from("activity_reactions").delete().eq("activity_id", a.id).eq("user_id", me)
      : await supabase.from("activity_reactions").insert({ activity_id: a.id });
    if (error) return void toast.error("Couldn't react. Try again.");
    qc.invalidateQueries({ queryKey: ["feed", me] });
  };

  if (feed.isLoading)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl bg-secondary" />
        ))}
      </div>
    );

  const items = feed.data ?? [];
  const friends = items.some((a) => a.user_id !== me);

  return (
    <div className="space-y-3">
      {!friends && (
        <div className="rounded-3xl bg-primary-soft p-5">
          <p className="text-lg font-extrabold">Your feed is quiet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When you and someone follow each other, you're friends, and their stamps, reviews and
            badges show up here.
          </p>
          <Button asChild className="mt-3 rounded-full">
            <Link to="/social" search={{ tab: "match" }}>
              <Sparkles className="size-4" /> Find your taste twins
            </Link>
          </Button>
        </div>
      )}
      {items.map((a) => {
        const p = people.data?.get(a.user_id);
        const spot = a.restaurant_id ? spotById.get(a.restaurant_id) : undefined;
        const badge = a.badge_id ? badges.data?.get(a.badge_id) : undefined;
        const { verb, emoji } = feedLine(a.kind);
        const own = a.user_id === me;
        return (
          <article key={a.id} className="rounded-3xl bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <Link to="/people/$id" params={{ id: a.user_id }}>
                <PersonAvatar person={p} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-snug">
                  <Link to="/people/$id" params={{ id: a.user_id }} className="font-extrabold">
                    {own ? "You" : firstName(p)}
                  </Link>{" "}
                  <span className="text-muted-foreground">{verb}</span>{" "}
                  {spot && (
                    <Link to="/r/$slug" params={{ slug: spot.slug }} className="font-bold">
                      {spot.name}
                    </Link>
                  )}
                  {badge && (
                    <span className="font-bold">
                      {badge.icon} {badge.name}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {emoji} {timeAgo(a.created_at)} ago
                  {a.kind === "review" && a.rating ? ` · ${"★".repeat(a.rating)}` : ""}
                </p>
              </div>
              {spot?.cover_url ? (
                <img
                  src={spot.cover_url}
                  alt=""
                  className="size-14 shrink-0 rounded-2xl object-cover"
                />
              ) : spot ? (
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-2xl">
                  {emojiFor(spot.category)}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => (own ? undefined : fire(a))}
                disabled={own}
                aria-pressed={a.mine}
                aria-label={a.mine ? "Remove fire" : "Send fire"}
                className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition active:scale-95 ${
                  a.mine
                    ? "bg-orange-500 text-white"
                    : "bg-secondary text-foreground disabled:opacity-70"
                }`}
              >
                <Flame className={`size-4 ${a.mine ? "fill-white" : ""}`} />
                {a.fires > 0 ? a.fires : own ? 0 : "Fire"}
              </button>
              {spot && !own && (
                <Link
                  to="/r/$slug"
                  params={{ slug: spot.slug }}
                  className="ml-auto text-sm font-semibold text-primary"
                >
                  Try it →
                </Link>
              )}
            </div>
          </article>
        );
      })}
      {items.length > 0 && (
        <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Friends' activity shows up 1 hour later, so no one
          knows where you are right now.
        </p>
      )}
    </div>
  );
}

/* ---------------- Tables ---------------- */

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Winnipeg",
  }).format(new Date(iso));

function Tables({ me }: { me: string }) {
  const qc = useQueryClient();
  const mine = useMySocial(me);
  const adult = isAdultDate(mine.data?.birth_date);
  const meetups = useMeetups(adult);
  const spots = useSpots();
  const spotById = useMemo(() => new Map((spots.data ?? []).map((s) => [s.id, s])), [spots.data]);
  const [creating, setCreating] = useState(false);
  const [rules, setRules] = useState<null | (() => void)>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const withRules = (fn: () => void) => (rulesAccepted() ? fn() : setRules(() => fn));

  const join = async (id: string, joined: boolean) => {
    setBusy(id);
    const { error } = joined
      ? await supabase.rpc("leave_meetup", { p_meetup_id: id })
      : await supabase.rpc("join_meetup", { p_meetup_id: id });
    setBusy(null);
    if (error) return void toast.error(error.message);
    toast.success(joined ? "You left the table" : "You're in! See you there 🍽️");
    qc.invalidateQueries({ queryKey: ["meetups"] });
    qc.invalidateQueries({ queryKey: ["table-members", id] });
  };

  if (mine.isLoading) return <div className="h-40 animate-pulse rounded-3xl bg-secondary" />;
  if (!adult) return <BirthdayGate userId={me} />;

  const list = meetups.data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-3xl bg-foreground p-5 text-background">
        <div className="flex-1">
          <p className="text-lg font-extrabold leading-tight">Plan a meal with friends</p>
          <p className="mt-0.5 text-sm opacity-80">
            Pick a spot and a time. Only your friends can see it and grab a seat.
          </p>
        </div>
        <Button
          size="lg"
          className="rounded-full"
          onClick={() => withRules(() => setCreating(true))}
        >
          <Plus className="size-4" /> Open
        </Button>
      </div>

      {meetups.isLoading &&
        [0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-3xl bg-secondary" />)}
      {!meetups.isLoading && list.length === 0 && (
        <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
          No plans from your friends yet. Open one, or find friends in Match. Friends are people you
          follow who follow you back.
        </p>
      )}

      {list.map((m) => {
        const spot = spotById.get(m.restaurant_id);
        const full = m.members >= m.seats;
        const host = m.host_id === me;
        return (
          <article key={m.id} className="overflow-hidden rounded-3xl bg-card shadow-card">
            <div className="relative h-28 bg-warm">
              {spot?.cover_url && (
                <img src={spot.cover_url} alt="" className="size-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              <div className="absolute inset-x-4 bottom-3 text-white">
                <p className="text-lg font-extrabold leading-tight">{m.title}</p>
                <p className="text-xs font-semibold opacity-90">
                  {spot?.name ?? "A Bity spot"} · {spot?.neighbourhood}
                </p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5 font-semibold">
                  <CalendarClock className="size-4 text-primary" /> {fmtWhen(m.starts_at)}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="size-4" /> {m.members} of {m.seats} seats
                </span>
              </div>
              <div className="mt-2 flex gap-1" aria-hidden>
                {Array.from({ length: m.seats }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${i < m.members ? "bg-primary" : "bg-secondary"}`}
                  />
                ))}
              </div>
              {m.note && <p className="mt-3 text-sm">{m.note}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                Hosted by{" "}
                <Link
                  to="/people/$id"
                  params={{ id: m.host_id }}
                  className="font-bold text-foreground"
                >
                  {host ? "you" : m.host_name}
                </Link>
              </p>
              {m.joined && <Members meetupId={m.id} me={me} />}
              <Button
                size="lg"
                variant={m.joined ? "secondary" : "default"}
                className="mt-3 w-full rounded-2xl"
                disabled={busy === m.id || (!m.joined && full)}
                onClick={() =>
                  m.joined
                    ? join(m.id, true)
                    : withRules(() => {
                        void join(m.id, false);
                      })
                }
              >
                {m.joined
                  ? host
                    ? "Cancel my table"
                    : "Leave table"
                  : full
                    ? "Table is full"
                    : "Grab a seat"}
              </Button>
            </div>
          </article>
        );
      })}

      <div className="rounded-3xl border border-dashed p-4 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 font-bold text-foreground">
          <ShieldCheck className="size-4 text-primary" /> Staying safe
        </p>
        <p className="mt-1">
          Friends only (you follow each other), 18+, and always at a restaurant. Only people at a
          table see who's going. Block or report anyone from their profile.
        </p>
        <button
          className="mt-2 font-semibold text-primary"
          onClick={() => setRules(() => () => {})}
        >
          Read the table rules
        </button>
      </div>

      <TableRulesDialog
        open={!!rules}
        onOpenChange={(v) => !v && setRules(null)}
        onAccept={() => {
          const next = rules;
          setRules(null);
          next?.();
        }}
      />
      <CreateTable open={creating} onOpenChange={setCreating} spots={spots.data ?? []} />
    </div>
  );
}

function Members({ meetupId, me }: { meetupId: string; me: string }) {
  const members = useQuery({
    queryKey: ["table-members", meetupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetup_members")
        .select("user_id")
        .eq("meetup_id", meetupId)
        .order("joined_at");
      if (error) throw error;
      return data.map((d) => d.user_id);
    },
  });
  const people = usePeople(members.data ?? []);
  if (!members.data?.length) return null;
  return (
    <div className="mt-3 rounded-2xl bg-secondary p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Who's going
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {members.data.map((id) => {
          const p = people.data?.get(id);
          return (
            <Link
              key={id}
              to="/people/$id"
              params={{ id }}
              className="flex items-center gap-1.5 rounded-full bg-card py-1 pl-1 pr-3 text-sm font-semibold"
            >
              <PersonAvatar person={p} size="size-7" text="text-xs" />
              {id === me ? "You" : firstName(p)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const PRESETS = [
  "Brunch crew 🥞",
  "Ramen night 🍜",
  "Taco Tuesday 🌮",
  "Coffee & chat ☕",
  "New in town 👋",
  "Pizza & games 🍕",
];

const toLocalInput = (d: Date) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

function CreateTable({
  open,
  onOpenChange,
  spots,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  spots: { id: string; name: string; neighbourhood: string | null }[];
}) {
  const qc = useQueryClient();
  const defaultTime = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(19, 0, 0, 0);
    return toLocalInput(d);
  };
  const [spot, setSpot] = useState("");
  const [title, setTitle] = useState<string>("Brunch crew 🥞");
  const [when, setWhen] = useState(defaultTime);
  const [seats, setSeats] = useState(4);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [open4, setOpen4] = useState(true);

  const min = toLocalInput(new Date(Date.now() + 31 * 60000));
  const max = toLocalInput(new Date(Date.now() + 14 * 86400000));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spot) return void toast.error("Pick a spot");
    setBusy(true);
    const { error } = await supabase.rpc("create_meetup", {
      p_restaurant_id: spot,
      p_title: title.trim(),
      p_note: note.trim(),
      p_starts_at: new Date(when).toISOString(),
      p_seats: open4 ? 4 : seats,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Your table is open 🎉");
    qc.invalidateQueries({ queryKey: ["meetups"] });
    onOpenChange(false);
    setNote("");
  };

  const fieldCls =
    "h-12 w-full rounded-2xl border bg-card px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] max-w-[430px] overflow-y-auto rounded-t-3xl pb-[max(env(safe-area-inset-bottom),1.5rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl font-extrabold">Open a table</SheetTitle>
          <SheetDescription>Only your friends will see this and can join.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-2 space-y-4 px-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Where</span>
            <select
              className={fieldCls}
              value={spot}
              onChange={(e) => setSpot(e.target.value)}
              required
            >
              <option value="">Pick a spot…</option>
              {spots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.neighbourhood ? ` · ${s.neighbourhood}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-sm font-semibold">What</span>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setTitle(p)}
                  className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold ${
                    title === p ? "bg-foreground text-background" : "bg-secondary"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              className={fieldCls}
              value={title}
              minLength={3}
              maxLength={60}
              required
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">When</span>
            <input
              type="datetime-local"
              className={fieldCls}
              min={min}
              max={max}
              value={when}
              required
              onChange={(e) => setWhen(e.target.value)}
            />
          </label>
          <div className="flex items-center justify-between rounded-2xl bg-secondary p-4">
            <span>
              <span className="block font-semibold">Classic table for 4</span>
              <span className="block text-xs text-muted-foreground">Turn off to pick 3 to 8</span>
            </span>
            <Switch checked={open4} onCheckedChange={setOpen4} />
          </div>
          {!open4 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Seats (including you)</span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setSeats((n) => Math.max(3, n - 1))}
                  aria-label="Fewer seats"
                >
                  −
                </Button>
                <span className="w-6 text-center text-lg font-extrabold">{seats}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setSeats((n) => Math.min(8, n + 1))}
                  aria-label="More seats"
                >
                  +
                </Button>
              </div>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Note (optional)</span>
            <textarea
              className="min-h-20 w-full rounded-2xl border bg-card px-4 py-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
              maxLength={280}
              placeholder="Trying the black garlic ramen. Everyone welcome!"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <Button type="submit" size="xl" className="w-full" disabled={busy}>
            {busy ? "Opening…" : "Open table"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Match ---------------- */

function Match({ me }: { me: string }) {
  const qc = useQueryClient();
  const mine = useMySocial(me);
  const matches = useMatches(true);
  const people = usePeople((matches.data ?? []).map((m) => m.user_id));

  const optIn = async (v: boolean) => {
    const { error } = await supabase.from("profiles").update({ discoverable: v }).eq("id", me);
    if (error) return void toast.error("Couldn't update. Try again.");
    qc.invalidateQueries({ queryKey: ["my-social"] });
    qc.invalidateQueries({ queryKey: ["taste-matches"] });
  };

  const list = (matches.data ?? []).filter((m) => m.score !== null);

  return (
    <div className="space-y-3">
      <div className="rounded-3xl bg-gradient-to-br from-primary to-rose-500 p-5 text-white shadow-pop">
        <p className="flex items-center gap-2 text-lg font-extrabold">
          <Sparkles className="size-5" /> Taste Match
        </p>
        <p className="mt-1 text-sm opacity-90">
          We compare the spots you've stamped and the kinds of food you love. 100% means you eat
          exactly alike.
        </p>
      </div>

      {mine.data && !mine.data.discoverable && (
        <label className="flex items-center justify-between gap-3 rounded-3xl bg-card p-4 shadow-card">
          <span>
            <span className="block font-bold">Let others find you too</span>
            <span className="block text-xs text-muted-foreground">
              You're hidden right now. Turn this on to show up in other people's matches.
            </span>
          </span>
          <Switch checked={false} onCheckedChange={optIn} />
        </label>
      )}

      {matches.isLoading &&
        [0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-3xl bg-secondary" />
        ))}
      {!matches.isLoading && list.length === 0 && (
        <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
          Collect a few passport stamps and we'll find people who eat like you.
        </p>
      )}

      {list.map((m) => {
        const p = people.data?.get(m.user_id) as Person | undefined;
        const score = Math.round(m.score ?? 0);
        const tone = matchTone(score);
        return (
          <div
            key={m.user_id}
            className="flex items-center gap-3 rounded-3xl bg-card p-3.5 shadow-card"
          >
            <Link to="/people/$id" params={{ id: m.user_id }} className="relative">
              <PersonAvatar person={p} size="size-14" text="text-xl" />
              <span
                className={`absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5 text-[11px] font-extrabold ring-2 ring-card ${tone.cls}`}
              >
                {score}%
              </span>
            </Link>
            <Link to="/people/$id" params={{ id: m.user_id }} className="min-w-0 flex-1">
              <p className="truncate font-extrabold">{firstName(p)}</p>
              {p?.username && (
                <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
              )}
              <p className="truncate text-xs font-semibold">
                {tone.label}
                {m.shared_spots > 0
                  ? ` · ${m.shared_spots} spot${m.shared_spots === 1 ? "" : "s"} in common`
                  : ""}
              </p>
            </Link>
            <FollowButton me={me} them={m.user_id} small />
          </div>
        );
      })}
    </div>
  );
}
