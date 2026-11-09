import { Link } from "@tanstack/react-router";
import { MapPin, Users } from "lucide-react";
import { categoryOf, isOnNow, priceLabel, whenLabel, type BityEvent } from "@/lib/events";

/** Gradient per category so events without a photo still look distinct. */
export const TINT: Record<string, string> = {
  game: "from-sky-600 to-indigo-700",
  concert: "from-fuchsia-600 to-purple-700",
  festival: "from-amber-500 to-rose-600",
  market: "from-emerald-500 to-teal-700",
  popup: "from-orange-500 to-red-600",
  "food-truck": "from-yellow-500 to-orange-600",
  "restaurant-night": "from-rose-500 to-red-700",
  cultural: "from-cyan-600 to-blue-700",
  community: "from-lime-600 to-emerald-700",
  other: "from-stone-500 to-stone-700",
};

export function FriendsGoing({ e, className = "" }: { e: BityEvent; className?: string }) {
  const s = e.stats;
  if (s.friends_going > 0) {
    const names = s.friend_names.join(", ");
    const more = s.friends_going - s.friend_names.length;
    return (
      <p className={`font-bold text-primary ${className}`}>
        👯 {names}
        {more > 0 ? ` +${more}` : ""} {s.friends_going === 1 ? "is" : "are"} going
      </p>
    );
  }
  if (s.going + s.interested === 0) return null;
  return (
    <p className={`flex items-center gap-1 text-muted-foreground ${className}`}>
      <Users className="size-3.5" />
      {s.going > 0 && `${s.going} going`}
      {s.going > 0 && s.interested > 0 && " · "}
      {s.interested > 0 && `${s.interested} interested`}
    </p>
  );
}

export function EventCard({ e, compact = false }: { e: BityEvent; compact?: boolean }) {
  const cat = categoryOf(e.category);
  const price = priceLabel(e);
  const live = isOnNow(e);
  return (
    <Link
      to="/events/$id"
      params={{ id: e.id }}
      className={`block overflow-hidden rounded-3xl bg-card shadow-card transition-transform active:scale-[0.98] ${compact ? "w-[260px] shrink-0" : ""}`}
    >
      <div
        className={`relative ${compact ? "h-28" : "h-36"} bg-gradient-to-br ${TINT[e.category] ?? TINT["other"]}`}
      >
        {e.photo_url ? (
          <img src={e.photo_url} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-5xl opacity-90">
            {cat.emoji}
          </span>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${live ? "bg-success text-success-foreground" : "bg-black/60 text-white"}`}
        >
          {live ? "● ON NOW" : whenLabel(e).toUpperCase()}
        </span>
        {price && (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-stone-900">
            {price}
          </span>
        )}
        {e.is_sample && (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-stone-700">
            Sample
          </span>
        )}
      </div>
      <div className="p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {cat.emoji} {cat.label}
        </p>
        <h3 className="mt-0.5 line-clamp-2 font-extrabold leading-tight">{e.title}</h3>
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          {e.venue_name}
        </p>
        <FriendsGoing e={e} className="mt-1.5 text-xs" />
        {e.stats.deals > 0 && (
          <p className="mt-1.5 inline-flex rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-extrabold text-primary">
            🍔 {e.stats.deals} food deal{e.stats.deals === 1 ? "" : "s"} for this
          </p>
        )}
      </div>
    </Link>
  );
}
