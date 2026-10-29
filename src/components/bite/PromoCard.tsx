import { Link } from "@tanstack/react-router";
import { Copy, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { emojiFor } from "@/lib/bite";
import { clockTime, type PromoRow } from "@/lib/live";

export function PromoCard({ p }: { p: PromoRow }) {
  const copy = async () => {
    if (!p.promo_code) return;
    try {
      await navigator.clipboard.writeText(p.promo_code);
      toast.success("Code copied");
    } catch {
      toast(p.promo_code);
    }
  };
  return (
    <article className="overflow-hidden rounded-3xl bg-card shadow-card">
      {p.photo_url && <img src={p.photo_url} alt={p.title} loading="lazy" className="aspect-[16/9] w-full object-cover" />}
      <div className="p-4">
        {p.restaurants && (
          <Link
            to="/r/$slug"
            params={{ slug: p.restaurants.slug }}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"
          >
            {p.restaurants.logo_url ? (
              <img src={p.restaurants.logo_url} alt="" className="size-6 rounded-lg object-cover" />
            ) : (
              <span>{emojiFor(p.restaurants.category)}</span>
            )}
            {p.restaurants.name}
          </Link>
        )}
        <h3 className="mt-2 flex items-start gap-2 text-lg font-extrabold leading-tight">
          {!p.photo_url && <Megaphone className="mt-0.5 size-5 shrink-0 text-primary" />}
          {p.title}
        </h3>
        {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {p.promo_code && (
            <button
              onClick={copy}
              className="flex h-10 items-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary-soft px-3 font-mono text-sm font-bold tracking-wider text-primary"
            >
              {p.promo_code} <Copy className="size-4" />
            </button>
          )}
          {p.ends_at && <span className="text-xs text-muted-foreground">Until {clockTime(p.ends_at)}</span>}
        </div>
      </div>
    </article>
  );
}
