import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Flame, Timer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatPrice, emojiFor } from "@/lib/bite";
import { clockTime, countdown, dropState, type DropRow } from "@/lib/live";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DropCard({ d, now }: { d: DropRow; now: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = dropState(d, now);
  const leftover = d.kind === "leftover";
  const pctLeft = Math.round((d.quantity_left / Math.max(1, d.quantity_total)) * 100);
  const discount =
    leftover && d.original_price_cents && d.original_price_cents > d.price_cents
      ? Math.round((1 - d.price_cents / d.original_price_cents) * 100)
      : 0;

  const claim = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("claim_drop", { p_drop_id: d.id });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["drops"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(leftover ? "Saved! It's yours 🎉" : "You got it! 🔥");
      navigate({ to: "/orders/$id", params: { id: data } });
    } catch (e) {
      toast.error((e as Error).message);
      qc.invalidateQueries({ queryKey: ["drops"] });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  const onClaim = () => {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/drops" } });
      return;
    }
    setConfirm(true);
  };

  return (
    <article
      className={`overflow-hidden rounded-3xl bg-card shadow-card ${state === "soldout" || state === "ended" ? "opacity-60" : ""}`}
    >
      <div className="relative aspect-[16/10] bg-muted">
        {d.photo_url ? (
          <img src={d.photo_url} alt={d.title} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-warm text-6xl">{leftover ? "🥡" : "🔥"}</div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          {state === "live" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-pop">
              <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" /> LIVE
            </span>
          )}
          {state === "upcoming" && (
            <span className="rounded-full bg-foreground/75 px-2.5 py-1 text-xs font-bold text-background backdrop-blur">
              Starts {clockTime(d.starts_at)}
            </span>
          )}
          {state === "soldout" && (
            <span className="rounded-full bg-foreground/75 px-2.5 py-1 text-xs font-bold text-background">Sold out</span>
          )}
          {state === "ended" && (
            <span className="rounded-full bg-foreground/75 px-2.5 py-1 text-xs font-bold text-background">Ended</span>
          )}
          {discount > 0 && (
            <span className="rounded-full bg-success px-2.5 py-1 text-xs font-bold text-success-foreground">
              {discount}% off
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        {d.restaurants && (
          <Link
            to="/r/$slug"
            params={{ slug: d.restaurants.slug }}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"
          >
            {d.restaurants.logo_url ? (
              <img src={d.restaurants.logo_url} alt="" className="size-6 rounded-lg object-cover" />
            ) : (
              <span>{emojiFor(d.restaurants.category)}</span>
            )}
            {d.restaurants.name}
          </Link>
        )}
        <h3 className="mt-2 text-xl font-extrabold leading-tight">{d.title}</h3>
        {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-2xl font-extrabold text-primary">{formatPrice(d.price_cents)}</span>
          {leftover && d.original_price_cents ? (
            <span className="text-sm text-muted-foreground line-through">{formatPrice(d.original_price_cents)}</span>
          ) : null}
        </div>

        {(state === "live" || state === "soldout") && (
          <div className="mt-3">
            <div className="flex justify-between text-xs font-semibold">
              <span className={pctLeft <= 25 && state === "live" ? "text-primary" : "text-muted-foreground"}>
                {state === "soldout" ? "All gone" : `${d.quantity_left} of ${d.quantity_total} left`}
              </span>
              {d.ends_at && state === "live" && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Timer className="size-3.5" />
                  {leftover ? `Pick up by ${clockTime(d.ends_at)}` : `Ends in ${countdown(new Date(d.ends_at).getTime() - now)}`}
                </span>
              )}
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pctLeft}%` }} />
            </div>
          </div>
        )}

        {state === "upcoming" && (
          <p className="mt-3 flex items-center gap-2 rounded-2xl bg-primary-soft p-3 text-sm font-bold text-primary">
            <Clock className="size-4" /> Drops in {countdown(new Date(d.starts_at).getTime() - now)} ·{" "}
            {d.quantity_total} available
          </p>
        )}

        {state === "live" && (
          <Button size="xl" className="mt-4 w-full" onClick={onClaim} disabled={busy}>
            <Flame className="size-5" />
            {leftover ? `Grab it · ${formatPrice(d.price_cents)}` : `Claim · ${formatPrice(d.price_cents)}`}
          </Button>
        )}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="max-w-[380px] rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{d.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {formatPrice(d.price_cents)} at {d.restaurants?.name}. Pick up within about 15 minutes. Test mode, no real
              charge.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Not now</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void claim();
              }}
            >
              {busy ? "Claiming…" : "Claim it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
