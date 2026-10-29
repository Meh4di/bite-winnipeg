import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Star } from "lucide-react";
import { ReviewCard, useReviews } from "@/components/bite/Reviews";
import { Button } from "@/components/ui/button";

export function OwnerReviews({ restaurantId }: { restaurantId: string }) {
  const reviews = useReviews(restaurantId);
  const qc = useQueryClient();
  const [photo, setPhoto] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const list = reviews.data ?? [];
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  const unanswered = list.filter((r) => !r.owner_reply).length;
  const shown = all ? list : list.slice(0, 3);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <MessageSquare className="size-5 text-primary" /> Reviews
        </h2>
        {list.length > 0 && (
          <span className="flex items-center gap-1 font-bold">
            <Star className="size-4 fill-amber-400 text-amber-400" /> {avg.toFixed(1)}
            <span className="text-sm font-normal text-muted-foreground">
              ({list.length}){unanswered ? ` · ${unanswered} to reply` : ""}
            </span>
          </span>
        )}
      </div>
      {!reviews.isLoading && list.length === 0 && (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-card">
          No reviews yet. Customers can review after they order or scan your counter code.
        </p>
      )}
      {shown.map((r) => (
        <ReviewCard
          key={r.id}
          r={r}
          mine={false}
          isOwner
          onPhoto={setPhoto}
          onChange={() => qc.invalidateQueries({ queryKey: ["reviews", restaurantId] })}
        />
      ))}
      {list.length > 3 && !all && (
        <Button variant="ghost" className="w-full" onClick={() => setAll(true)}>
          See all {list.length}
        </Button>
      )}
      {photo && (
        <button className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4" onClick={() => setPhoto(null)} aria-label="Close photo">
          <img src={photo} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
        </button>
      )}
    </section>
  );
}
