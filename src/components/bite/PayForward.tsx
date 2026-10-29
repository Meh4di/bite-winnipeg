import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/bite";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { label: "A coffee", cents: 400 },
  { label: "A snack", cents: 700 },
  { label: "A full meal", cents: 1500 },
];

export function useForwardCounts() {
  return useQuery({
    queryKey: ["forward-counts"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("forward_counts");
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.restaurant_id, r]));
    },
  });
}

export function PayForwardCard({
  restaurantId,
  slug,
  name,
}: {
  restaurantId: string;
  slug: string;
  name: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const counts = useForwardCounts();
  const [busy, setBusy] = useState<number | null>(null);
  const c = counts.data?.get(restaurantId);

  const buy = async (o: (typeof OPTIONS)[number]) => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (
      !confirm(
        `Pay forward ${o.label.toLowerCase()} (${formatPrice(o.cents)}) at ${name} for someone who needs it? Test mode, no real charge.`,
      )
    )
      return;
    setBusy(o.cents);
    const { error } = await supabase.rpc("buy_forward", {
      p_restaurant_id: restaurantId,
      p_label: o.label,
      p_amount_cents: o.cents,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Thank you 💛 Someone's day just got better.");
    qc.invalidateQueries({ queryKey: ["forward-counts"] });
    qc.invalidateQueries({ queryKey: ["passport"] });
    qc.invalidateQueries({ queryKey: ["city-impact"] });
  };

  return (
    <section
      className="mt-6 rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/30"
      aria-labelledby={`pf-${slug}`}
    >
      <h2 id={`pf-${slug}`} className="flex items-center gap-2 text-lg font-extrabold">
        <HeartHandshake className="size-5 text-amber-600" /> Pay it forward
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Buy something for a stranger. Anyone who needs a meal can ask at the counter, no questions
        asked.
      </p>
      {c && (c.waiting > 0 || c.given > 0) && (
        <p className="mt-2 text-sm font-bold text-amber-700 dark:text-amber-300">
          {c.waiting} waiting · {c.given} given so far
        </p>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <Button
            key={o.cents}
            variant="secondary"
            className="h-auto flex-col gap-0 bg-card py-2.5"
            disabled={busy !== null}
            onClick={() => buy(o)}
          >
            <span className="text-sm font-bold">{o.label}</span>
            <span className="text-xs text-muted-foreground">
              {busy === o.cents ? "…" : formatPrice(o.cents)}
            </span>
          </Button>
        ))}
      </div>
    </section>
  );
}
