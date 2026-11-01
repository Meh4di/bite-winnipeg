import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Clock, LockOpen, MapPin, Share2, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/bite";
import { useNow } from "@/lib/live";
import {
  countdown,
  crewLink,
  fmtWhen,
  isReached,
  percentOff,
  unlockState,
  useUnlockDeals,
} from "@/lib/unlock";
import { Button } from "@/components/ui/button";
import { UnlockProgress } from "@/components/bite/UnlockCard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_tabs/unlock/$id")({
  validateSearch: (s: Record<string, unknown>): { crew?: string } => {
    const c = s["crew"];
    return typeof c === "string" && UUID.test(c) ? { crew: c } : {};
  },
  head: () => ({
    meta: [
      { title: "Unlock deal — Bity" },
      {
        name: "description",
        content: "Join with others to unlock a bigger discount at a Winnipeg restaurant.",
      },
      { property: "og:title", content: "Help unlock this deal on Bity" },
      { property: "og:description", content: "If enough people join, everyone gets the deal." },
    ],
  }),
  component: UnlockPage,
});

const HOW = [
  ["🙋", "Join for free", "No payment now. You're just saying you'll come."],
  ["📣", "Bring friends", "Share the link. The more people join, the sooner it unlocks."],
  ["🔓", "Goal reached? Deal's on", "Everyone who joined gets the deal price."],
  ["🤷", "Not reached?", "Nothing happens and nobody pays. No risk."],
] as const;

const CREW_HOW = [
  ["👯", "Start a crew", "Free. You're saying you'll come with friends."],
  ["💬", "Send the link", "Drop your crew link in the group chat."],
  ["🔓", "Crew full? Deal's on", "It unlocks for your crew right away. No waiting on strangers."],
  ["🤷", "Not enough friends?", "Nothing happens and nobody pays. No risk."],
] as const;

function UnlockPage() {
  const { id } = Route.useParams();
  const { crew: invite } = Route.useSearch();
  const { user } = useAuth();
  const router = useRouter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const now = useNow(1000);
  const q = useUnlockDeals({ dealId: id });
  const d = q.data?.[0];
  const [busy, setBusy] = useState(false);
  const isCrew = !!d?.crew_size;
  const inviteInfo = useQuery({
    queryKey: ["crew-invite", id, invite],
    enabled: !!invite && isCrew && !d?.mine,
    queryFn: async () => {
      const { data } = await supabase.rpc("crew_invite", { p_deal_id: id, p_crew: invite! });
      return data?.[0] ?? null;
    },
  });
  const crew = useQuery({
    queryKey: ["my-crew", id, d?.crew_joined],
    enabled: isCrew && !!d?.mine,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_crew", { p_deal_id: id });
      if (error) throw error;
      return data ?? [];
    },
  });
  const joiningCrew = isCrew && !!inviteInfo.data;

  const back = (
    <button
      onClick={() =>
        window.history.length > 1
          ? router.history.back()
          : router.navigate({ to: "/drops", search: { tab: "unlock" } })
      }
      className="grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
      aria-label="Back"
    >
      <ArrowLeft className="size-5" />
    </button>
  );

  if (q.isLoading) return <div className="m-5 h-80 animate-pulse rounded-3xl bg-secondary" />;
  if (!d)
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),1.25rem)] text-center">
        <p className="mt-20 text-5xl">🔒</p>
        <p className="mt-3 text-xl font-extrabold">This deal isn't available</p>
        <Button asChild className="mt-5 rounded-full">
          <Link to="/drops" search={{ tab: "unlock" }}>
            See other unlock deals
          </Link>
        </Button>
      </div>
    );

  const s = unlockState(d, now);
  const img = d.photo_url ?? d.restaurants?.cover_url;
  const canJoin = (s === "open" || s === "unlocked") && !d.mine;
  const canLeave = d.mine && s === "open";

  const act = async (join: boolean) => {
    if (!user) {
      navigate({
        to: "/auth",
        search: { redirect: `/unlock/${d.id}${invite ? `?crew=${invite}` : ""}` },
      });
      return;
    }
    setBusy(true);
    const { data, error } = join
      ? await supabase.rpc("join_unlock", {
          p_deal_id: d.id,
          ...(joiningCrew ? { p_crew: invite! } : {}),
        })
      : await supabase.rpc("leave_unlock", { p_deal_id: d.id });
    setBusy(false);
    if (error) return void toast.error(error.message);
    if (join) {
      const n = (data as number) ?? 0;
      if (isCrew) {
        const left = (d.crew_size ?? 0) - n;
        toast.success(
          left <= 0
            ? "Your crew is full. Deal unlocked! 🎉"
            : joiningCrew
              ? `You're in the crew! ${left} more to go.`
              : `Crew started! Invite ${left} friend${left === 1 ? "" : "s"} to unlock it.`,
        );
      } else
        toast.success(
          n >= d.goal
            ? "You're in, and the deal is unlocked! 🎉"
            : `You're in! ${d.goal - n} more to unlock. Share it with friends.`,
        );
    } else toast.success("You've left this deal");
    qc.invalidateQueries({ queryKey: ["unlock-deals"] });
  };

  const share = async () => {
    const mineCrew = isCrew && d.my_crew;
    const url = mineCrew ? crewLink(d.id, d.my_crew!) : `${window.location.origin}/unlock/${d.id}`;
    const left = Math.max(0, (d.crew_size ?? 0) - (d.crew_joined ?? 0));
    const text = mineCrew
      ? `Join my crew for ${d.title} at ${d.restaurants?.name}: ${formatPrice(d.deal_price_cents)} instead of ${formatPrice(d.regular_price_cents)}. ${left > 0 ? `We need ${left} more!` : "We're in!"}`
      : `Help me unlock ${d.title} at ${d.restaurants?.name} on Bity: ${formatPrice(d.deal_price_cents)} instead of ${formatPrice(d.regular_price_cents)}. ${Math.max(0, d.goal - d.joined)} more people needed!`;
    try {
      if (navigator.share) await navigator.share({ title: d.title, text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Link copied. Paste it in your group chat!");
      }
    } catch {
      /* share sheet closed */
    }
  };

  return (
    <div className="animate-screen pb-10">
      <div className="relative h-64 bg-warm">
        {img && <img src={img} alt="" className="size-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
        <div className="absolute left-4 top-[max(env(safe-area-inset-top),1rem)]">{back}</div>
        <div className="absolute inset-x-5 bottom-4 text-white">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${isReached(s) ? "bg-success" : "bg-white/20 backdrop-blur"}`}
          >
            {isCrew
              ? isReached(s) && d.mine
                ? "👯 CREW UNLOCKED"
                : `👯 CREW DEAL · ${d.crew_size}`
              : isReached(s)
                ? "🔓 UNLOCKED"
                : "🔒 UNLOCK DEAL"}{" "}
            · −{percentOff(d)}%
          </span>
          <h1 className="mt-2 text-[28px] font-extrabold leading-[1.05]">{d.title}</h1>
          {d.restaurants && (
            <Link
              to="/r/$slug"
              params={{ slug: d.restaurants.slug }}
              className="mt-1 inline-flex items-center gap-1 text-sm font-semibold opacity-90"
            >
              <MapPin className="size-4" /> {d.restaurants.name} · {d.restaurants.neighbourhood}
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-4 px-5 pt-5">
        <div className="flex items-end justify-between">
          <p>
            <span className="text-4xl font-extrabold">{formatPrice(d.deal_price_cents)}</span>{" "}
            <span className="text-lg text-muted-foreground line-through">
              {formatPrice(d.regular_price_cents)}
            </span>
          </p>
          <p className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
            <Clock className="size-4" />
            {s === "open" || s === "unlocked"
              ? `Closes in ${countdown(d.ends_at, now)}`
              : `Closed ${fmtWhen(d.ends_at)}`}
          </p>
        </div>

        {joiningCrew && !d.mine && (
          <div className="rounded-3xl bg-primary-soft p-4">
            <p className="text-lg font-extrabold text-primary">
              👋 {inviteInfo.data!.leader_name} invited you to their crew
            </p>
            <p className="mt-1 text-sm">
              {inviteInfo.data!.members} of {d.crew_size} in so far. Join and the deal unlocks for
              all of you once the crew is full.
            </p>
          </div>
        )}

        <div className="rounded-3xl bg-card p-4 shadow-card">
          <UnlockProgress deal={d} big />
          {isCrew && d.mine && (crew.data?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {crew.data!.map((m, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-1 pr-2.5 text-xs font-bold"
                >
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="size-6 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-6 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">
                      {m.first_name[0]}
                    </span>
                  )}
                  {m.is_me ? "You" : m.first_name}
                  {m.is_leader && " 👑"}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {d.max_spots - d.joined > 0
              ? `${d.max_spots - d.joined} spots left in total.`
              : "All spots are taken."}{" "}
            Pickup until {fmtWhen(d.pickup_until)}
          </p>
        </div>

        {d.description && <p className="text-[15px]">{d.description}</p>}

        {d.mine && isReached(s) && (
          <div className="rounded-3xl bg-success p-5 text-center text-white shadow-pop">
            <LockOpen className="mx-auto size-8" />
            <p className="mt-1 text-sm font-semibold opacity-90">Your pickup code</p>
            <p className="font-display text-5xl font-extrabold tracking-[0.2em]">{d.my_code}</p>
            <p className="mt-2 text-sm opacity-90">
              {d.redeemed
                ? "Picked up. Enjoy! 😋"
                : `Show this at ${d.restaurants?.name} and pay ${formatPrice(d.deal_price_cents)} at the counter. Pick up by ${fmtWhen(d.pickup_until)}`}
            </p>
          </div>
        )}
        {isCrew && d.mine && !isReached(s) && s !== "failed" && (
          <div className="rounded-3xl bg-primary-soft p-4 text-sm">
            <p className="font-bold text-primary">You're in the crew ✓</p>
            <p className="mt-1">
              Invite {(d.crew_size ?? 0) - (d.crew_joined ?? 0)} more. Only people with your link
              can join your crew. You won't pay anything unless it unlocks.
            </p>
            <Button className="mt-3 w-full rounded-full" onClick={share}>
              <UserPlus className="size-4" /> Invite friends
            </Button>
          </div>
        )}
        {!isCrew && d.mine && !isReached(s) && s !== "failed" && (
          <div className="rounded-3xl bg-primary-soft p-4 text-sm">
            <p className="font-bold text-primary">You're in ✓</p>
            <p className="mt-1">
              We need {d.goal - d.joined} more. Send the link to your group chat. You won't pay
              anything unless it unlocks.
            </p>
          </div>
        )}
        {s === "failed" && (
          <p className="rounded-3xl bg-secondary p-4 text-sm">
            {isCrew
              ? "This crew deal has closed. If your crew wasn't full, nobody pays anything."
              : "This one didn't reach its goal, so nobody pays anything. Watch for the next one!"}
          </p>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          {canJoin ? (
            <Button size="xl" className="w-full" disabled={busy} onClick={() => act(true)}>
              {!user
                ? "Sign in to join"
                : joiningCrew
                  ? `Join ${inviteInfo.data!.leader_name}'s crew`
                  : isCrew
                    ? "Start a crew, it's free"
                    : "Join, it's free"}
            </Button>
          ) : canLeave ? (
            <Button
              size="xl"
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => act(false)}
            >
              Leave
            </Button>
          ) : (
            <Button size="xl" variant="secondary" className="w-full" disabled>
              {s === "full"
                ? "All spots taken"
                : d.mine
                  ? "You're in ✓"
                  : s === "cancelled"
                    ? "Cancelled"
                    : "Closed"}
            </Button>
          )}
          <Button
            size="xl"
            variant="outline"
            className="aspect-square px-0 shadow-none"
            onClick={share}
            aria-label="Share"
          >
            <Share2 className="size-5" />
          </Button>
        </div>

        <section className="rounded-3xl bg-card p-4 shadow-card">
          <h2 className="font-extrabold">
            {isCrew ? "How crew deals work" : "How unlock deals work"}
          </h2>
          <ul className="mt-3 space-y-3">
            {(isCrew ? CREW_HOW : HOW).map(([e, t, sub]) => (
              <li key={t} className="flex gap-3">
                <span className="text-2xl">{e}</span>
                <span>
                  <span className="block font-bold">{t}</span>
                  <span className="block text-sm text-muted-foreground">{sub}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" /> The price shown is the price you pay. No fees, no
            tip screen.
          </p>
        </section>
      </div>
    </div>
  );
}
