import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Flag, Store } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Shown on a real spot that hasn't joined Bity yet: facts only, a way for customers to ask it to
 * join (the count becomes the pitch), and a way for the owner to claim it. */
export function UnclaimedCard({ id, name, slug }: { id: string; name: string; slug: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const info = useQuery({
    queryKey: ["spot-requests", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("spot_request_info", { p_restaurant_id: id });
      return data?.[0] ?? { requests: 0, mine: false };
    },
  });
  const n = info.data?.requests ?? 0;
  const mine = info.data?.mine ?? false;

  const ask = async () => {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/r/${slug}` } });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("request_spot", { p_restaurant_id: id });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(`Asked! We'll let ${name} know people want them on Bity.`);
    qc.invalidateQueries({ queryKey: ["spot-requests", id] });
  };

  const share = async () => {
    const url = window.location.href;
    const text = `I want ${name} on Bity! Tap "Get them on Bity" so they join: ${url}`;
    try {
      if (navigator.share) await navigator.share({ title: name, text, url });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Link copied");
      }
    } catch {
      /* closed */
    }
  };

  return (
    <div className="mt-5 space-y-3">
      <div className="rounded-3xl bg-primary-soft p-5">
        <p className="text-xs font-extrabold uppercase tracking-widest text-primary">
          Not on Bity yet
        </p>
        <p className="mt-1 text-lg font-extrabold leading-tight">Want {name} on Bity?</p>
        <p className="mt-1 text-sm">
          Ask them to join. The more people ask, the sooner you'll see their deals, menu and
          ordering here.
        </p>
        {n > 0 && (
          <p className="mt-3 text-sm font-extrabold text-primary">
            🙋 {n} {n === 1 ? "person has" : "people have"} asked
          </p>
        )}
        {mine ? (
          <div className="mt-3 space-y-2">
            <p className="rounded-2xl bg-card px-3 py-2 text-sm font-semibold">
              ✓ You asked. You're following them, so you'll see their first deal.
            </p>
            <Button
              onClick={share}
              variant="outline"
              className="w-full rounded-2xl bg-card shadow-none"
            >
              Get friends to ask too
            </Button>
          </div>
        ) : (
          <Button disabled={busy} onClick={ask} className="mt-3 w-full rounded-2xl" size="lg">
            🙋 Get them on Bity
          </Button>
        )}
      </div>
      <Button asChild variant="outline" className="w-full rounded-2xl shadow-none" size="lg">
        <Link to="/claim/$id" params={{ id }}>
          <Store className="size-4" /> Own this place? Claim it, free
        </Link>
      </Button>
    </div>
  );
}

export function SampleBanner() {
  return (
    <p className="mt-4 rounded-2xl bg-amber-400/20 p-3 text-sm font-semibold">
      🧪 Sample spot: made up to show how Bity works. It isn't a real restaurant.
    </p>
  );
}

const REASONS = [
  { key: "closed", label: "It's permanently closed" },
  { key: "wrong_info", label: "The address or details are wrong" },
  { key: "other", label: "Something else" },
] as const;

export function ReportListing({ restaurantId }: { restaurantId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["key"]>("closed");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("listing_reports")
      .insert({ restaurant_id: restaurantId, reason, note: note.trim() || null });
    setBusy(false);
    if (error && error.code !== "23505") return void toast.error("Couldn't send. Try again.");
    setOpen(false);
    toast.success("Thanks! We'll check it.");
  };

  return (
    <>
      <button
        onClick={() => (user ? setOpen(true) : navigate({ to: "/auth" }))}
        className="mx-auto mt-8 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
      >
        <Flag className="size-3.5" /> Something wrong with this listing?
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>What's wrong?</DialogTitle>
            <DialogDescription>Help us keep Bity accurate.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2" role="radiogroup">
            {REASONS.map((r) => (
              <button
                key={r.key}
                role="radio"
                aria-checked={reason === r.key}
                onClick={() => setReason(r.key)}
                className={`flex h-12 w-full items-center rounded-2xl border-2 px-4 text-left text-sm font-semibold ${
                  reason === r.key ? "border-primary bg-primary-soft" : "border-border"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            className="min-h-16 w-full rounded-2xl border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            placeholder="Anything we should know? (optional)"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button size="xl" className="w-full" disabled={busy} onClick={send}>
            Send
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
