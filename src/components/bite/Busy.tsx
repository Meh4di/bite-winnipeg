import { Clock, Star } from "lucide-react";
import { BUSY, minutesAgo, type BusyInfo } from "@/lib/community";

/** "Busy · ~20 min wait · updated 5 min ago" or the kitchen queue when there's no owner update. */
export function BusyLine({ busy, queue, compact = false }: { busy: BusyInfo | null; queue?: number | undefined; compact?: boolean }) {
  if (!busy && !queue) return null;
  const meta = busy?.level ? BUSY[busy.level] : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold">
      {meta && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${meta.pill}`}>
          <span className="size-1.5 animate-pulse rounded-full bg-current" /> {meta.label}
        </span>
      )}
      {busy?.wait !== null && busy?.wait !== undefined && (
        <span className="inline-flex items-center gap-1 text-foreground">
          <Clock className="size-3.5" /> {busy.wait === 0 ? "No wait" : `~${busy.wait} min wait`}
        </span>
      )}
      {!busy && queue ? (
        <span className="text-muted-foreground">
          {queue} {queue === 1 ? "order" : "orders"} in the kitchen
        </span>
      ) : null}
      {busy?.updatedAt && !compact && <span className="font-normal text-muted-foreground">· {minutesAgo(busy.updatedAt)}</span>}
    </span>
  );
}

export function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-border"}`} />
      ))}
    </span>
  );
}

export function RatingPill({ avg, count }: { avg: number; count: number }) {
  if (!count) return <span className="text-xs text-muted-foreground">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-bold">
      <Star className="size-4 fill-amber-400 text-amber-400" />
      {avg.toFixed(1)} <span className="font-normal text-muted-foreground">({count})</span>
    </span>
  );
}
