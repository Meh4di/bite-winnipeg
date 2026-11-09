import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, ExternalLink, MapPin, Navigation, Share2, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { emojiFor } from "@/lib/bite";
import { isVerified } from "@/components/bite/Verification";
import {
  EVENT_TAGS,
  categoryOf,
  isOnNow,
  km,
  priceLabel,
  rsvp,
  useEvent,
  useEventDeals,
} from "@/lib/events";
import { FriendsGoing, TINT } from "@/components/bite/EventCard";

export const Route = createFileRoute("/_tabs/events_/$id")({
  head: () => ({ meta: [{ title: "Event — Bity" }] }),
  component: EventPage,
});

const fmtRange = (a: string, b: string) => {
  const s = new Date(a);
  const e = new Date(b);
  const day = (d: Date) =>
    d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  return s.toDateString() === e.toDateString()
    ? `${day(s)} · ${t(s)} – ${t(e)}`
    : `${day(s)} ${t(s)} – ${day(e)} ${t(e)}`;
};

function EventPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: e, isLoading } = useEvent(id);
  const deals = useEventDeals(id);
  const [busy, setBusy] = useState(false);

  // Restaurants close to the venue: the "eat before or after" list.
  const nearby = useQuery({
    queryKey: ["near-event", e?.lat, e?.lng],
    enabled: e?.lat != null && e?.lng != null,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id, slug, name, category, neighbourhood, logo_url, lat, lng, same_price_pledge")
        .eq("is_active", true)
        .not("lat", "is", null);
      return (data ?? [])
        .map((r) => ({ ...r, d: km(e!.lat!, e!.lng!, r.lat!, r.lng!) }))
        .filter((r) => r.d <= 2.5)
        .sort((a, b) => a.d - b.d)
        .slice(0, 8);
    },
  });

  // Owners can attach a deal for people going to this event.
  const mine = useQuery({
    queryKey: ["my-restaurant-lite", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id, name, verification_status")
        .eq("owner_id", user!.id)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const dealIds = useMemo(
    () => new Set((deals.data ?? []).map((d) => d.restaurant_id)),
    [deals.data],
  );

  if (isLoading) return <div className="m-5 h-96 animate-pulse rounded-3xl bg-muted" />;
  if (!e)
    return (
      <div className="px-5 pt-16 text-center">
        <p className="text-5xl">📅</p>
        <h1 className="mt-3 text-xl font-extrabold">Event not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">It may have ended or been removed.</p>
        <Button asChild className="mt-5 rounded-full">
          <Link to="/events">See what's on</Link>
        </Button>
      </div>
    );

  const cat = categoryOf(e.category);
  const price = priceLabel(e);
  const ended = new Date(e.ends_at).getTime() < Date.now();
  const mineStatus = e.stats.my_status;

  const choose = async (s: "going" | "interested") => {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/events/${e.id}` } });
      return;
    }
    setBusy(true);
    try {
      await rsvp(e.id, mineStatus === s ? null : s);
      if (mineStatus !== s)
        toast.success(
          s === "going" ? "You're going! 🎉 Your friends can see it." : "Saved as interested",
        );
      await qc.invalidateQueries({ queryKey: ["events"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/events/${e.id}`;
    const text =
      mineStatus === "going"
        ? `I'm going to ${e.title} at ${e.venue_name}. Come with? 👯`
        : `${e.title} at ${e.venue_name}. Want to go?`;
    try {
      if (navigator.share) await navigator.share({ title: e.title, text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Link copied. Send it to your friends!");
      }
    } catch {
      /* share sheet closed */
    }
  };

  const cancel = async () => {
    const { error } = await supabase.rpc("cancel_event", { p_event_id: e.id });
    if (error) return void toast.error(error.message);
    toast.success("Event cancelled");
    await qc.invalidateQueries({ queryKey: ["events"] });
    navigate({ to: "/events" });
  };

  return (
    <div className="animate-screen pb-8">
      <div className={`relative h-56 bg-gradient-to-br ${TINT[e.category] ?? TINT["other"]}`}>
        {e.photo_url ? (
          <img src={e.photo_url} alt="" className="size-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-7xl">{cat.emoji}</span>
        )}
        <button
          onClick={() =>
            window.history.length > 1 ? router.history.back() : navigate({ to: "/events" })
          }
          className="absolute left-4 top-[max(env(safe-area-inset-top),1rem)] grid size-10 place-items-center rounded-full bg-black/50 text-white"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <button
          onClick={share}
          className="absolute right-4 top-[max(env(safe-area-inset-top),1rem)] grid size-10 place-items-center rounded-full bg-black/50 text-white"
          aria-label="Share"
        >
          <Share2 className="size-5" />
        </button>
      </div>

      <div className="space-y-4 px-5 pt-4">
        {e.status !== "approved" && (
          <p className="rounded-2xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {e.status === "pending"
              ? "⏳ Waiting for review. Only you can see this until Bity approves it (usually within a day)."
              : e.status === "cancelled"
                ? "This event was cancelled."
                : `Not approved${e.review_note ? `: ${e.review_note}` : ""}.`}
          </p>
        )}
        {e.is_sample && (
          <p className="rounded-2xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
            Sample event to show how Bity works. Not a real event.
          </p>
        )}

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {cat.emoji} {cat.label}
            {isOnNow(e) && <span className="ml-2 text-success">● ON NOW</span>}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight">{e.title}</h1>
        </div>

        <div className="space-y-2 rounded-3xl bg-card p-4 text-sm shadow-card">
          <p className="flex items-start gap-2">
            <Calendar className="mt-0.5 size-4 shrink-0 text-primary" />
            {fmtRange(e.starts_at, e.ends_at)}
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <b>{e.venue_name}</b>
              {e.address && <span className="block text-muted-foreground">{e.address}</span>}
            </span>
          </p>
          {price && (
            <p className="flex items-center gap-2">
              <span className="w-4 text-center text-primary">$</span>
              {price}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(`${e.venue_name}, ${e.address ?? ""} Winnipeg, MB`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold"
            >
              <Navigation className="size-3.5" /> Directions
            </a>
            {e.link_url && (
              <a
                href={e.link_url}
                target="_blank"
                rel="noreferrer nofollow"
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold"
              >
                <ExternalLink className="size-3.5" /> Tickets & info
              </a>
            )}
          </div>
        </div>

        {!ended && e.status === "approved" && (
          <div className="rounded-3xl bg-card p-4 shadow-card">
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={busy}
                variant={mineStatus === "going" ? "default" : "outline"}
                className="h-12 rounded-full text-base"
                onClick={() => choose("going")}
              >
                {mineStatus === "going" ? "✓ Going" : "🙋 Going"}
              </Button>
              <Button
                disabled={busy}
                variant={mineStatus === "interested" ? "default" : "outline"}
                className="h-12 rounded-full text-base"
                onClick={() => choose("interested")}
              >
                <Star className="size-4" />
                {mineStatus === "interested" ? "Interested ✓" : "Interested"}
              </Button>
            </div>
            <FriendsGoing e={e} className="mt-3 text-sm" />
            <button
              onClick={share}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary-soft py-2.5 text-sm font-bold text-primary"
            >
              👯 Plan it with friends
            </button>
          </div>
        )}

        {e.description && (
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{e.description}</p>
        )}
        {e.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {e.tags.map((t) => (
              <span key={t} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">
                {EVENT_TAGS.find((x) => x.key === t)?.label ?? t}
              </span>
            ))}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">🍔 Eat near this event</h2>
          {(deals.data ?? []).map((d) => (
            <Link
              key={d.id}
              to="/r/$slug"
              params={{ slug: d.restaurants?.slug ?? "" }}
              className="flex items-center gap-3 rounded-3xl bg-primary-soft p-3.5"
            >
              <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-card text-2xl">
                {d.restaurants?.logo_url ? (
                  <img src={d.restaurants.logo_url} alt="" className="size-full object-cover" />
                ) : (
                  emojiFor(d.restaurants?.category ?? "")
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-primary">
                  {d.restaurants?.name} · EVENT DEAL
                </span>
                <span className="block font-extrabold leading-tight">{d.title}</span>
                {d.details && (
                  <span className="block text-xs text-muted-foreground">{d.details}</span>
                )}
              </span>
            </Link>
          ))}
          {(nearby.data ?? [])
            .filter((r) => !dealIds.has(r.id))
            .map((r) => (
              <Link
                key={r.id}
                to="/r/$slug"
                params={{ slug: r.slug }}
                className="flex items-center gap-3 rounded-3xl bg-card p-3 shadow-card"
              >
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-secondary text-xl">
                  {r.logo_url ? (
                    <img src={r.logo_url} alt="" className="size-full object-cover" />
                  ) : (
                    emojiFor(r.category)
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.category} ·{" "}
                    {r.d < 1 ? `${Math.round(r.d * 1000)} m` : `${r.d.toFixed(1)} km`} away
                    {r.same_price_pledge ? " · 🤝 Same price" : ""}
                  </span>
                </span>
              </Link>
            ))}
          {(deals.data ?? []).length === 0 && (nearby.data ?? []).length === 0 && (
            <p className="rounded-3xl bg-card p-4 text-sm text-muted-foreground shadow-card">
              No Bity spots close to this one yet. Know a great place nearby? Tell them about Bity!
            </p>
          )}
        </section>

        {mine.data && isVerified(mine.data) && !ended && e.status === "approved" && (
          <OwnerDeal eventId={e.id} restaurantId={mine.data.id} name={mine.data.name} />
        )}

        {user?.id === e.created_by && e.status !== "cancelled" && !ended && (
          <button onClick={cancel} className="w-full py-2 text-sm font-semibold text-destructive">
            Cancel this event
          </button>
        )}
      </div>
    </div>
  );
}

function OwnerDeal({
  eventId,
  restaurantId,
  name,
}: {
  eventId: string;
  restaurantId: string;
  name: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (title.trim().length < 3)
      return void toast.error("Write the deal, e.g. Show your ticket: free fries");
    setBusy(true);
    const { error } = await supabase.rpc("add_event_deal", {
      p_event_id: eventId,
      p_restaurant_id: restaurantId,
      p_title: title,
      p_details: details || null,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Your deal is on this event 🎉");
    setTitle("");
    setDetails("");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["event-deals", eventId] }),
      qc.invalidateQueries({ queryKey: ["events"] }),
    ]);
  };
  return (
    <section className="rounded-3xl bg-[#1C1917] p-4 text-white">
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">Bity Business · {name}</p>
      <h2 className="mt-1 font-extrabold">Get people from this event through your door</h2>
      <p className="mt-1 text-sm opacity-80">
        Add a deal for people going. It shows on this event under "Eat near this event".
      </p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        placeholder="e.g. Show your ticket: free fries"
        className="mt-3 h-11 w-full rounded-2xl bg-white/10 px-3 text-sm placeholder:text-white/50"
      />
      <input
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={300}
        placeholder="Details (optional): before 7pm, dine-in only…"
        className="mt-2 h-11 w-full rounded-2xl bg-white/10 px-3 text-sm placeholder:text-white/50"
      />
      <Button disabled={busy} onClick={save} className="mt-3 w-full rounded-full">
        Add my deal
      </Button>
    </section>
  );
}
