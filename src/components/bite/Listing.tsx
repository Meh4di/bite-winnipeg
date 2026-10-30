import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Flag, Store } from "lucide-react";
import { toast } from "sonner";
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

/** Shown on a real spot that hasn't joined Bite yet: facts only, plus a way for the owner to claim it. */
export function UnclaimedCard({ id, name }: { id: string; name: string }) {
  return (
    <div className="mt-5 rounded-3xl border-2 border-dashed border-border p-5">
      <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
        Not on Bite yet
      </p>
      <p className="mt-1 text-[15px]">
        {name} is a local Winnipeg spot that hasn't joined Bite yet, so there's no menu, deals or
        ordering here. Follow it and you'll see its first deal as soon as it joins.
      </p>
      <Button asChild variant="outline" className="mt-4 w-full rounded-2xl shadow-none" size="lg">
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
      🧪 Sample spot: made up to show how Bite works. It isn't a real restaurant.
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
            <DialogDescription>Help us keep Bite accurate.</DialogDescription>
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
