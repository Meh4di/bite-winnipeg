import { Link } from "@tanstack/react-router";
import { emojiFor, openState } from "@/lib/bite";
import { BUSY, type BusyInfo } from "@/lib/community";

export type RestaurantSummary = {
  id: string;
  slug: string;
  name: string;
  category: string;
  neighbourhood: string | null;
  cover_url: string | null;
  logo_url: string | null;
  hours: unknown;
  verification_status?: string;
  is_sample?: boolean;
};

export type CardExtras = {
  rating?: { avg: number; count: number } | undefined;
  busy?: BusyInfo | null | undefined;
  special?: string | undefined;
  deal?: "drop" | "rescue" | null | undefined;
};

export function OpenBadge({ open }: { open: boolean | null }) {
  if (open === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur ${
        open ? "bg-success text-success-foreground" : "bg-foreground/75 text-background"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${open ? "bg-success-foreground" : "bg-background/70"}`}
      />
      {open ? "Open now" : "Closed"}
    </span>
  );
}

/** Uber Eats-style store card: big photo, name with rating bubble, one line of details. */
export function RestaurantCard({
  r,
  x,
  compact = false,
}: {
  r: RestaurantSummary;
  x?: CardExtras;
  compact?: boolean;
}) {
  const open = openState(r.hours);
  const unclaimed = r.verification_status === "unclaimed";
  const busy = x?.busy?.level ? BUSY[x.busy.level] : null;
  return (
    <Link
      to="/r/$slug"
      params={{ slug: r.slug }}
      className={`group block transition-transform active:scale-[0.98] ${compact ? "w-[260px] shrink-0" : ""}`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl bg-muted ${compact ? "aspect-[16/10]" : "aspect-[16/9]"}`}
      >
        {r.cover_url ? (
          <img
            src={r.cover_url}
            alt=""
            loading="lazy"
            className={`size-full object-cover ${open === false ? "grayscale-[40%]" : ""}`}
          />
        ) : (
          <div className="grid size-full place-items-center text-6xl">{emojiFor(r.category)}</div>
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {x?.deal === "drop" && (
            <Badge className="bg-primary text-primary-foreground">🔥 Drop live</Badge>
          )}
          {x?.deal === "rescue" && (
            <Badge className="bg-success text-success-foreground">♻️ Save food</Badge>
          )}
          {open === false && <Badge className="bg-foreground/75 text-background">Closed</Badge>}
          {unclaimed && <Badge className="bg-background/90 text-foreground">Not on Bity yet</Badge>}
          {r.is_sample && <Badge className="bg-amber-400 text-black">Sample</Badge>}
          {open && busy && (
            <Badge className={busy.pill}>
              {busy.label}
              {x?.busy?.wait ? ` · ${x.busy.wait} min` : ""}
            </Badge>
          )}
        </div>
        {r.logo_url && !compact && (
          <img
            src={r.logo_url}
            alt=""
            className="absolute bottom-2.5 left-2.5 size-10 rounded-xl object-cover ring-2 ring-white"
          />
        )}
      </div>
      <div className="mt-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-bold leading-tight tracking-tight">{r.name}</h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {emojiFor(r.category)} {r.category} · {r.neighbourhood}
          </p>
          {x?.special && <p className="mt-0.5 truncate text-sm">⭐ {x.special}</p>}
        </div>
        {x?.rating && x.rating.count > 0 && (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">
            {x.rating.avg.toFixed(1)}
          </span>
        )}
      </div>
    </Link>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm ${className}`}>
      {children}
    </span>
  );
}
