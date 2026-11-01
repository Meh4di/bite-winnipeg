import { Link } from "@tanstack/react-router";
import { Lock, LockOpen, Users } from "lucide-react";
import { formatPrice } from "@/lib/bite";
import { countdown, isReached, percentOff, unlockState, type UnlockDeal } from "@/lib/unlock";

export function UnlockProgress({ deal, big }: { deal: UnlockDeal; big?: boolean }) {
  if (deal.crew_size) return <CrewProgress deal={deal} big={big} />;
  const pct = Math.min(100, Math.round((deal.joined / deal.goal) * 100));
  const reached = deal.joined >= deal.goal;
  return (
    <div>
      <div className={`overflow-hidden rounded-full bg-secondary ${big ? "h-3.5" : "h-2.5"}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${reached ? "bg-success" : "bg-gradient-to-r from-amber-400 to-primary"}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <div
        className={`mt-1.5 flex items-center justify-between font-semibold ${big ? "text-sm" : "text-xs"}`}
      >
        <span className="flex items-center gap-1">
          <Users className="size-3.5" />{" "}
          {reached ? `${deal.joined} joined` : `${deal.joined} of ${deal.goal} joined`}
        </span>
        <span className={reached ? "text-success" : "text-primary"}>
          {reached ? "Unlocked 🎉" : `${deal.goal - deal.joined} more to unlock`}
        </span>
      </div>
    </div>
  );
}

function CrewProgress({ deal, big }: { deal: UnlockDeal; big?: boolean | undefined }) {
  const size = deal.crew_size ?? 2;
  const n = deal.mine ? (deal.crew_joined ?? 1) : 0;
  const reached = deal.mine && n >= size;
  const text = big ? "text-sm" : "text-xs";
  return (
    <div>
      <div className="flex gap-1.5" aria-label={`${n} of ${size} in your crew`}>
        {Array.from({ length: size }, (_, i) => (
          <span
            key={i}
            className={`grid flex-1 place-items-center rounded-full font-extrabold transition-all ${big ? "h-9 text-base" : "h-7 text-sm"} ${
              i < n
                ? reached
                  ? "bg-success text-success-foreground"
                  : "bg-primary text-primary-foreground"
                : "border-2 border-dashed border-muted-foreground/30 text-muted-foreground/50"
            }`}
          >
            {i < n ? "🙋" : "+"}
          </span>
        ))}
      </div>
      <div className={`mt-1.5 flex items-center justify-between font-semibold ${text}`}>
        <span className="flex items-center gap-1">
          <Users className="size-3.5" />
          {deal.mine ? `${n} of ${size} in your crew` : `Crew of ${size}, you included`}
        </span>
        <span className={reached ? "text-success" : "text-primary"}>
          {reached
            ? "Unlocked 🎉"
            : deal.mine
              ? `${size - n} more friend${size - n === 1 ? "" : "s"}`
              : (deal.crews_unlocked ?? 0) > 0
                ? `${deal.crews_unlocked} crew${deal.crews_unlocked === 1 ? "" : "s"} unlocked`
                : "No waiting on strangers"}
        </span>
      </div>
    </div>
  );
}

export function UnlockCard({ deal, now, wide }: { deal: UnlockDeal; now: number; wide?: boolean }) {
  const s = unlockState(deal, now);
  const img = deal.photo_url ?? deal.restaurants?.cover_url;
  return (
    <Link
      to="/unlock/$id"
      params={{ id: deal.id }}
      className={`block shrink-0 overflow-hidden rounded-3xl bg-card shadow-card active:scale-[0.98] ${wide ? "w-full" : "w-[78%]"}`}
    >
      <div className="relative h-32 bg-warm">
        {img && <img src={img} alt="" className="size-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white ${
            isReached(s) ? "bg-success" : "bg-black/60 backdrop-blur"
          }`}
        >
          {deal.crew_size ? (
            "👯"
          ) : isReached(s) ? (
            <LockOpen className="size-3.5" />
          ) : (
            <Lock className="size-3.5" />
          )}
          {deal.crew_size
            ? isReached(s) && deal.mine
              ? "CREW UNLOCKED"
              : `CREW DEAL · ${deal.crew_size}`
            : isReached(s)
              ? "UNLOCKED"
              : "UNLOCK DEAL"}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold text-primary-foreground">
          −{percentOff(deal)}%
        </span>
        <div className="absolute inset-x-3 bottom-2.5 text-white">
          <p className="truncate text-[17px] font-extrabold leading-tight">{deal.title}</p>
          <p className="truncate text-xs font-semibold opacity-90">{deal.restaurants?.name}</p>
        </div>
      </div>
      <div className="space-y-2.5 p-3.5">
        <div className="flex items-baseline justify-between">
          <p>
            <span className="text-lg font-extrabold">{formatPrice(deal.deal_price_cents)}</span>{" "}
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(deal.regular_price_cents)}
            </span>
          </p>
          <span className="text-xs font-semibold text-muted-foreground">
            {s === "open" || s === "unlocked"
              ? `Closes in ${countdown(deal.ends_at, now)}`
              : s === "full"
                ? "All spots taken"
                : s === "failed"
                  ? deal.crew_size
                    ? "Closed"
                    : "Didn't unlock"
                  : s === "cancelled"
                    ? "Cancelled"
                    : "Closed"}
          </span>
        </div>
        <UnlockProgress deal={deal} />
        {deal.mine && (
          <p className="rounded-xl bg-primary-soft px-3 py-1.5 text-center text-xs font-bold text-primary">
            You're in ✓
          </p>
        )}
      </div>
    </Link>
  );
}
