import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Small "★ 4.6 (12) · #2 Latte" line with tap-to-rate for verified customers. */
export function DishRate({
  itemId,
  restaurantId,
  stats,
  mine,
  rank,
  dishType,
  canRate,
}: {
  itemId: string;
  restaurantId: string;
  stats: { avg: number; count: number } | undefined;
  mine: number | undefined;
  rank: number | undefined;
  dishType: string | null;
  canRate: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const rate = async (n: number) => {
    const { error } = await supabase
      .from("dish_ratings")
      .upsert(
        { menu_item_id: itemId, restaurant_id: restaurantId, rating: n },
        { onConflict: "menu_item_id,user_id" },
      );
    if (error) {
      toast.error(
        error.message.includes("row-level security")
          ? "Order or visit here first to rate dishes."
          : error.message,
      );
      return;
    }
    setOpen(false);
    toast.success("Thanks! Your rating counts toward Best in the Peg 🏆");
    qc.invalidateQueries({ queryKey: ["dish-ratings", restaurantId] });
    qc.invalidateQueries({ queryKey: ["dish-leaderboard"] });
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
      {stats && stats.count > 0 && (
        <span className="inline-flex items-center gap-1 font-semibold">
          <Star className="size-3.5 fill-amber-400 text-amber-400" /> {stats.avg.toFixed(1)}
          <span className="font-normal text-muted-foreground">({stats.count})</span>
        </span>
      )}
      {rank && rank <= 3 && dishType && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"} #{rank} {dishType.toLowerCase()} in the Peg
        </span>
      )}
      {canRate && !open && (
        <button onClick={() => setOpen(true)} className="font-semibold text-primary">
          {mine ? `You gave ${mine}★ · change` : "Rate this dish"}
        </button>
      )}
      {open && (
        <span
          className="inline-flex items-center gap-0.5"
          role="radiogroup"
          aria-label="Rate this dish"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => rate(n)}
              aria-label={`${n} stars`}
              className="p-0.5 active:scale-90"
            >
              <Star
                className={`size-6 ${n <= (mine ?? 0) ? "fill-amber-400 text-amber-400" : "text-border"}`}
              />
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
