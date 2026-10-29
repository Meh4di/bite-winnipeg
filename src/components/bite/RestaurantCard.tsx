import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { emojiFor, isOpenNow } from "@/lib/bite";

export type RestaurantSummary = {
  id: string;
  slug: string;
  name: string;
  category: string;
  neighbourhood: string | null;
  cover_url: string | null;
  logo_url: string | null;
  hours: unknown;
};

export function OpenBadge({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur ${
        open ? "bg-success text-success-foreground" : "bg-foreground/70 text-background"
      }`}
    >
      <span className={`size-1.5 rounded-full ${open ? "bg-success-foreground" : "bg-background/70"}`} />
      {open ? "Open now" : "Closed"}
    </span>
  );
}

export function RestaurantCard({ r }: { r: RestaurantSummary }) {
  const open = isOpenNow(r.hours);
  return (
    <Link
      to="/r/$slug"
      params={{ slug: r.slug }}
      className="block overflow-hidden rounded-3xl bg-card shadow-card transition-transform active:scale-[0.98]"
    >
      <div className="relative aspect-[16/9] bg-muted">
        {r.cover_url && (
          <img src={r.cover_url} alt={r.name} loading="lazy" className="size-full object-cover" />
        )}
        <div className="absolute left-3 top-3">
          <OpenBadge open={open} />
        </div>
      </div>
      <div className="flex items-center gap-3 p-4">
        {r.logo_url ? (
          <img src={r.logo_url} alt="" className="size-11 rounded-2xl object-cover ring-2 ring-background" />
        ) : (
          <div className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-xl">
            {emojiFor(r.category)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold leading-tight">{r.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
            <span>
              {emojiFor(r.category)} {r.category}
            </span>
            <span>·</span>
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{r.neighbourhood}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
