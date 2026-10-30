import { Link } from "@tanstack/react-router";
import { emojiFor, formatPrice } from "@/lib/bite";
import { dishEmoji } from "@/lib/dishes";
import type { ValueItem } from "@/lib/eats";

export function ValueCard({ item, fixed }: { item: ValueItem; fixed?: boolean }) {
  if (!item.restaurants) return null;
  return (
    <Link
      to="/r/$slug"
      params={{ slug: item.restaurants.slug }}
      className={`block overflow-hidden rounded-2xl bg-card shadow-card active:scale-[0.98] ${fixed ? "w-[160px] shrink-0" : ""}`}
    >
      <div className="relative aspect-square bg-secondary">
        {item.photo_url ? (
          <img src={item.photo_url} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-5xl">
            {item.dish_type ? dishEmoji(item.dish_type) : emojiFor(item.restaurants.category)}
          </div>
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-background/95 px-2.5 py-1 text-sm font-extrabold shadow-card">
          {formatPrice(item.price_cents)}
        </span>
        {item.is_small_plate && (
          <span className="absolute right-2 top-2 rounded-full bg-success px-2 py-0.5 text-[10px] font-extrabold text-white">
            SMALL PLATE
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-bold">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.restaurants.name} · {item.restaurants.neighbourhood}
        </p>
      </div>
    </Link>
  );
}
