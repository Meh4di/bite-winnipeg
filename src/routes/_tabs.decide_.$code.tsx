import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Heart, MapPin, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { emojiFor, openState } from "@/lib/bite";
import { Button } from "@/components/ui/button";
import { OpenBadge } from "@/components/bite/RestaurantCard";
import { useRestaurants } from "./_tabs.decide";

export const Route = createFileRoute("/_tabs/decide_/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Swipe with friends — Bity" },
      {
        name: "description",
        content: "Swipe on Winnipeg spots with your friends until you match.",
      },
      { property: "og:title", content: "Join my Bity group" },
      { property: "og:description", content: "Swipe with me to pick where we eat." },
    ],
  }),
  component: Group,
});

function Group() {
  const { code } = Route.useParams();
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const restaurants = useRestaurants();
  const [sid, setSid] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [seenMatches, setSeenMatches] = useState<Set<string>>(new Set());
  const [matchShown, setMatchShown] = useState<string | null>(null);
  const joined = useRef(false);

  useEffect(() => {
    if (loading || !user || joined.current) return;
    joined.current = true;
    supabase.rpc("join_decide_session", { p_code: code }).then(({ data, error }) => {
      if (error) setJoinError(error.message);
      else setSid(data);
    });
  }, [loading, user, code]);

  useEffect(() => {
    if (!sid) return;
    const channel = supabase
      .channel(`decide-${sid}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "decide_votes", filter: `session_id=eq.${sid}` },
        () => qc.invalidateQueries({ queryKey: ["decide", sid] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "decide_members", filter: `session_id=eq.${sid}` },
        () => qc.invalidateQueries({ queryKey: ["decide", sid] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sid, qc]);

  const group = useQuery({
    queryKey: ["decide", sid],
    enabled: !!sid,
    refetchInterval: 8000,
    queryFn: async () => {
      if (!sid) return null;
      const [session, members, votes] = await Promise.all([
        supabase.from("decide_sessions").select("*").eq("id", sid).single(),
        supabase.from("decide_members").select("*").eq("session_id", sid).order("joined_at"),
        supabase.from("decide_votes").select("user_id, restaurant_id, liked").eq("session_id", sid),
      ]);
      if (session.error) throw session.error;
      return { session: session.data, members: members.data ?? [], votes: votes.data ?? [] };
    },
  });

  const deckAll = useMemo(() => {
    const cat = group.data?.session.category;
    return (restaurants.data ?? []).filter((r) => !cat || r.category === cat);
  }, [restaurants.data, group.data?.session.category]);

  const myVotes = useMemo(
    () =>
      new Map(
        (group.data?.votes ?? [])
          .filter((v) => v.user_id === user?.id)
          .map((v) => [v.restaurant_id, v.liked]),
      ),
    [group.data?.votes, user?.id],
  );
  const deck = deckAll.filter((r) => !myVotes.has(r.id));
  const memberCount = group.data?.members.length ?? 0;

  const tally = useMemo(() => {
    const likes = new Map<string, number>();
    for (const v of group.data?.votes ?? [])
      if (v.liked) likes.set(v.restaurant_id, (likes.get(v.restaurant_id) ?? 0) + 1);
    return deckAll
      .map((r) => ({ r, likes: likes.get(r.id) ?? 0 }))
      .filter((x) => x.likes > 0)
      .sort((a, b) => b.likes - a.likes);
  }, [group.data?.votes, deckAll]);
  const matches = memberCount >= 2 ? tally.filter((t) => t.likes >= memberCount) : [];

  useEffect(() => {
    const fresh = matches.find((m) => !seenMatches.has(m.r.id));
    if (fresh) {
      setSeenMatches((s) => new Set(s).add(fresh.r.id));
      setMatchShown(fresh.r.id);
      navigator.vibrate?.([40, 60, 40]);
    }
  }, [matches, seenMatches]);

  const vote = async (restaurantId: string, liked: boolean) => {
    if (!sid || !user) return;
    qc.setQueryData(["decide", sid], (old: typeof group.data) =>
      old
        ? {
            ...old,
            votes: [
              ...old.votes.filter(
                (v) => !(v.user_id === user.id && v.restaurant_id === restaurantId),
              ),
              { user_id: user.id, restaurant_id: restaurantId, liked },
            ],
          }
        : old,
    );
    const { error } = await supabase
      .from("decide_votes")
      .upsert(
        { session_id: sid, user_id: user.id, restaurant_id: restaurantId, liked },
        { onConflict: "session_id,user_id,restaurant_id" },
      );
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["decide", sid] });
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/decide/${code}`;
    const text = `Help me pick where to eat! Join my Bity group: ${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Bity", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Link copied");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  if (!loading && !user)
    return (
      <Center emoji="🤝" title={`Join group ${code}`} line="Sign in to swipe with your friends.">
        <Button asChild size="xl" className="w-full">
          <Link to="/auth" search={{ redirect: `/decide/${code}` }}>
            Sign in to join
          </Link>
        </Button>
      </Center>
    );
  if (joinError)
    return (
      <Center emoji="🤷" title="Couldn't join" line={joinError}>
        <Button asChild size="xl" className="w-full">
          <Link to="/decide">Back to Decide</Link>
        </Button>
      </Center>
    );
  if (!group.data || restaurants.isLoading)
    return <div className="m-5 h-96 animate-pulse rounded-3xl bg-muted" />;

  const top = deck[0];
  const shown = matchShown ? deckAll.find((r) => r.id === matchShown) : null;

  return (
    <div className="animate-screen space-y-5 px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <header className="flex items-center gap-3">
        <Link
          to="/decide"
          aria-label="Back"
          className="grid size-11 place-items-center rounded-full bg-card shadow-card"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground">
            Group
            {group.data.session.category
              ? ` · ${emojiFor(group.data.session.category)} ${group.data.session.category}`
              : ""}
          </p>
          <p className="font-mono text-2xl font-extrabold tracking-[0.25em]">{code}</p>
        </div>
        <Button variant="secondary" className="h-11" onClick={share}>
          <Share2 className="size-4" /> Invite
        </Button>
      </header>

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {group.data.members.map((m) => {
          const n = group.data!.votes.filter((v) => v.user_id === m.user_id).length;
          return (
            <span
              key={m.user_id}
              className="flex shrink-0 items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3 text-sm font-semibold shadow-card"
            >
              <span className="grid size-7 place-items-center rounded-full bg-warm text-xs font-extrabold text-primary-foreground">
                {m.display_name.charAt(0).toUpperCase()}
              </span>
              {m.user_id === user?.id ? "You" : m.display_name}
              <span className="text-xs text-muted-foreground">
                {n}/{deckAll.length}
              </span>
            </span>
          );
        })}
        {memberCount < 2 && (
          <span className="shrink-0 self-center text-sm text-muted-foreground">
            Waiting for friends to join…
          </span>
        )}
      </div>

      {top ? (
        <SwipeCard key={top.id} r={top} onVote={(liked) => vote(top.id, liked)} />
      ) : (
        <div className="rounded-3xl bg-card p-6 text-center shadow-card">
          <p className="text-5xl">{matches.length ? "🎉" : "⏳"}</p>
          <p className="mt-2 text-lg font-extrabold">
            {matches.length ? "You've got a match!" : "You're done swiping"}
          </p>
          <p className="text-sm text-muted-foreground">
            {matches.length
              ? "Everyone liked the spots below."
              : memberCount < 2
                ? "Invite friends to find a match."
                : "Waiting on your friends…"}
          </p>
        </div>
      )}

      {tally.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">
            {matches.length ? "Matches & favourites" : "Group favourites"}
          </h2>
          <div className="space-y-2">
            {tally.slice(0, 6).map(({ r, likes }) => (
              <Link
                key={r.id}
                to="/r/$slug"
                params={{ slug: r.slug }}
                className={`flex items-center gap-3 rounded-2xl p-3 shadow-card active:scale-[0.98] ${likes >= memberCount && memberCount >= 2 ? "bg-primary-soft ring-2 ring-primary" : "bg-card"}`}
              >
                <span className="text-2xl">{emojiFor(r.category)}</span>
                <span className="flex-1 truncate font-semibold">{r.name}</span>
                <span className="flex items-center gap-1 text-sm font-bold text-primary">
                  <Heart className="size-4 fill-current" /> {likes}/{memberCount}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {shown && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-6"
          onClick={() => setMatchShown(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-pop animate-stamp"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-6xl">🎉</p>
            <h2 className="mt-3 text-3xl font-extrabold">It's a match!</h2>
            <p className="mt-1 text-muted-foreground">Everyone wants</p>
            <p className="mt-1 text-2xl font-extrabold text-primary">{shown.name}</p>
            <Button asChild size="xl" className="mt-6 w-full">
              <Link to="/r/$slug" params={{ slug: shown.slug }}>
                Let's go
              </Link>
            </Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setMatchShown(null)}>
              Keep swiping
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type SwipeRestaurant = {
  id: string;
  name: string;
  category: string;
  neighbourhood: string | null;
  cover_url: string | null;
  hours: unknown;
  description: string | null;
};

function SwipeCard({ r, onVote }: { r: SwipeRestaurant; onVote: (liked: boolean) => void }) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<null | boolean>(null);
  const start = useRef<number | null>(null);

  const finish = (liked: boolean) => {
    setLeaving(liked);
    window.setTimeout(() => onVote(liked), 180);
  };
  const offset = leaving === null ? dx : leaving ? 600 : -600;

  return (
    <div className="relative">
      <div
        role="group"
        aria-label={r.name}
        className="relative touch-pan-y select-none overflow-hidden rounded-3xl bg-card shadow-pop"
        style={{
          transform: `translateX(${offset}px) rotate(${offset / 18}deg)`,
          transition: start.current === null ? "transform 0.2s ease-out" : "none",
        }}
        onPointerDown={(e) => {
          start.current = e.clientX;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (start.current !== null) setDx(e.clientX - start.current);
        }}
        onPointerUp={() => {
          const d = dx;
          start.current = null;
          if (Math.abs(d) > 110) finish(d > 0);
          else setDx(0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDx(0);
        }}
      >
        <div className="relative aspect-[4/5] bg-muted">
          {r.cover_url ? (
            <img src={r.cover_url} alt="" draggable={false} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-8xl">{emojiFor(r.category)}</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="absolute left-4 top-4">
            <OpenBadge open={openState(r.hours)} />
          </div>
          {dx > 40 && <Stamp className="left-4 border-success text-success" text="YUM" />}
          {dx < -40 && <Stamp className="right-4 border-white text-white" text="NAH" />}
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <p className="text-sm font-semibold opacity-90">
              {emojiFor(r.category)} {r.category}
            </p>
            <h3 className="text-3xl font-extrabold leading-tight">{r.name}</h3>
            <p className="mt-1 flex items-center gap-1 text-sm opacity-90">
              <MapPin className="size-4" /> {r.neighbourhood}
            </p>
            {r.description && (
              <p className="mt-2 line-clamp-2 text-sm opacity-90">{r.description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-6">
        <button
          aria-label="Nah"
          onClick={() => finish(false)}
          className="grid size-16 place-items-center rounded-full bg-card text-muted-foreground shadow-card active:scale-90"
        >
          <X className="size-8" />
        </button>
        <button
          aria-label="Yum"
          onClick={() => finish(true)}
          className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-pop active:scale-90"
        >
          <Heart className="size-8 fill-current" />
        </button>
      </div>
    </div>
  );
}

function Stamp({ text, className }: { text: string; className: string }) {
  return (
    <span
      className={`absolute top-6 rotate-[-12deg] rounded-xl border-4 px-3 py-1 text-3xl font-extrabold ${className}`}
    >
      {text}
    </span>
  );
}

function Center({
  emoji,
  title,
  line,
  children,
}: {
  emoji: string;
  title: string;
  line: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-8 text-center animate-screen">
      <p className="text-6xl">{emoji}</p>
      <h1 className="mt-4 text-3xl font-extrabold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{line}</p>
      <div className="mt-6 w-full max-w-xs">{children}</div>
    </div>
  );
}
