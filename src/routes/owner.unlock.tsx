import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/bite";
import { useNow } from "@/lib/live";
import {
  countdown,
  fmtWhen,
  isReached,
  percentOff,
  unlockState,
  useUnlockDeals,
  type UnlockDeal,
} from "@/lib/unlock";
import { UnlockProgress } from "@/components/bite/UnlockCard";
import { ImagePick } from "@/components/bite/ImagePick";
import { LockedTool, isVerified } from "@/components/bite/Verification";
import { Route as OwnerRoute, useMyRestaurant } from "./owner";

export const Route = createFileRoute("/owner/unlock")({ component: Gated });

function Gated() {
  const { data: r, isLoading } = useMyRestaurant();
  if (isLoading) return <div className="m-5 h-40 animate-pulse rounded-3xl bg-muted" />;
  if (r && !isVerified(r))
    return <LockedTool title="Unlock deals" status={r.verification_status} />;
  if (!r) return null;
  return <OwnerUnlock restaurantId={r.id} />;
}

const field =
  "h-12 w-full rounded-2xl border bg-card px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";

const toLocal = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function OwnerUnlock({ restaurantId }: { restaurantId: string }) {
  const now = useNow(15_000);
  const deals = useUnlockDeals({ restaurantId });
  const [creating, setCreating] = useState(false);
  const live = (deals.data ?? []).filter((d) => !d.cancelled);

  return (
    <div className="space-y-4 px-5 pt-5 animate-screen">
      <div>
        <h1 className="text-2xl font-extrabold">Unlock deals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Offer a big discount that only switches on if enough people commit. You get guaranteed
          volume on a slow night and know exactly how much to prep. If the goal isn't reached,
          nothing happens.
        </p>
      </div>

      {creating ? (
        <CreateUnlock restaurantId={restaurantId} onDone={() => setCreating(false)} />
      ) : (
        <Button size="xl" className="w-full" onClick={() => setCreating(true)}>
          <Plus className="size-5" /> New unlock deal
        </Button>
      )}

      {deals.isLoading && <div className="h-40 animate-pulse rounded-3xl bg-muted" />}
      {!deals.isLoading && live.length === 0 && !creating && (
        <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
          No unlock deals yet. Try one for your slowest night of the week.
        </p>
      )}
      {live.map((d) => (
        <OwnerDealCard key={d.id} d={d} now={now} />
      ))}
    </div>
  );
}

function OwnerDealCard({ d, now }: { d: UnlockDeal; now: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const s = unlockState(d, now);
  const list = useQuery({
    queryKey: ["unlock-pledges", d.id],
    enabled: open,
    refetchInterval: open ? 20_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("unlock_pledge_list", { p_deal_id: d.id });
      if (error) throw error;
      return data ?? [];
    },
  });

  const redeem = async (id: string) => {
    const { error } = await supabase.rpc("redeem_unlock", { p_pledge_id: id });
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["unlock-pledges", d.id] });
  };
  const cancel = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const { error } = await supabase
      .from("unlock_deals")
      .update({ cancelled: true })
      .eq("id", d.id);
    if (error) return void toast.error("Couldn't cancel. Try again.");
    toast.success("Deal cancelled");
    qc.invalidateQueries({ queryKey: ["unlock-deals"] });
  };

  return (
    <article className="rounded-3xl bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold">{d.title}</p>
          <p className="text-sm text-muted-foreground">
            {formatPrice(d.deal_price_cents)}{" "}
            <span className="line-through">{formatPrice(d.regular_price_cents)}</span> · −
            {percentOff(d)}%
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            isReached(s)
              ? "bg-success/15 text-success"
              : s === "failed"
                ? "bg-secondary"
                : "bg-amber-500/15 text-amber-600"
          }`}
        >
          {isReached(s)
            ? "Unlocked"
            : s === "failed"
              ? "Didn't unlock"
              : `Closes in ${countdown(d.ends_at, now)}`}
        </span>
      </div>
      <div className="mt-3">
        <UnlockProgress deal={d} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Join by {fmtWhen(d.ends_at)} · pickup until {fmtWhen(d.pickup_until)} · max {d.max_spots}
      </p>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 flex w-full items-center justify-between rounded-2xl bg-secondary px-4 py-3 text-sm font-bold"
      >
        Who's coming ({d.joined})
        <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-2 divide-y">
          {list.data?.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">
              Nobody yet. Share it on your socials!
            </li>
          )}
          {list.data?.map((p) => (
            <li key={p.pledge_id} className="flex items-center gap-3 py-2.5">
              <span className="w-20 font-mono text-base font-extrabold tracking-widest">
                {p.code}
              </span>
              <span className="flex-1 text-sm font-semibold">{p.first_name}</span>
              {p.redeemed_at ? (
                <span className="flex items-center gap-1 text-xs font-bold text-success">
                  <Check className="size-4" /> Picked up
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  disabled={!isReached(s)}
                  onClick={() => redeem(p.pledge_id)}
                >
                  Picked up
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {(s === "open" || s === "unlocked") && (
        <button onClick={cancel} className="mt-3 text-xs font-semibold text-destructive">
          {confirming
            ? `Tap again to cancel${d.joined ? ` (${d.joined} people will see it's off)` : ""}`
            : "Cancel this deal"}
        </button>
      )}
    </article>
  );
}

function CreateUnlock({ restaurantId, onDone }: { restaurantId: string; onDone: () => void }) {
  const { userId } = OwnerRoute.useRouteContext();
  const qc = useQueryClient();
  const tomorrow = (h: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(h, 0, 0, 0);
    return toLocal(d);
  };
  const [f, setF] = useState({
    title: "",
    description: "",
    regular: "",
    deal: "",
    goal: "10",
    max: "30",
    ends: tomorrow(15),
    pickup: tomorrow(21),
    photo_url: null as string | null,
  });
  const [busy, setBusy] = useState(false);
  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));
  const reg = Math.round(parseFloat(f.regular || "0") * 100);
  const deal = Math.round(parseFloat(f.deal || "0") * 100);
  const off = reg > 0 && deal < reg ? Math.round((1 - deal / reg) * 100) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const goal = parseInt(f.goal, 10);
    const max = parseInt(f.max, 10);
    if (!(reg > 0) || !(deal >= 0) || deal >= reg)
      return void toast.error("The deal price has to be lower than the regular price");
    if (!(goal >= 2) || !(max >= goal))
      return void toast.error("Max spots must be at least the goal (and the goal at least 2)");
    const ends = new Date(f.ends);
    const pickup = new Date(f.pickup);
    if (ends.getTime() < Date.now() + 30 * 60000)
      return void toast.error("Close it at least 30 minutes from now");
    if (ends.getTime() > Date.now() + 7 * 86400000)
      return void toast.error("Close it within 7 days");
    if (pickup <= ends || pickup.getTime() > ends.getTime() + 3 * 86400000)
      return void toast.error("Pickup must end after it closes, within 3 days");
    setBusy(true);
    const { error } = await supabase.from("unlock_deals").insert({
      restaurant_id: restaurantId,
      title: f.title.trim(),
      description: f.description.trim() || null,
      photo_url: f.photo_url,
      regular_price_cents: reg,
      deal_price_cents: deal,
      goal,
      max_spots: max,
      ends_at: ends.toISOString(),
      pickup_until: pickup.toISOString(),
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Your unlock deal is live 🔓");
    qc.invalidateQueries({ queryKey: ["unlock-deals"] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-3xl bg-card p-4 shadow-card">
      <ImagePick
        bucket="menu-photos"
        userId={userId}
        value={f.photo_url}
        onChange={(u) => setF((p) => ({ ...p, photo_url: u }))}
        label="Photo (optional)"
        className="h-36 w-full"
      />
      <input
        className={field}
        placeholder="What's the deal? e.g. Any ramen for $11"
        required
        minLength={3}
        maxLength={80}
        value={f.title}
        onChange={set("title")}
      />
      <textarea
        className="min-h-20 w-full rounded-2xl border bg-card px-4 py-3 text-base outline-none focus:border-primary"
        placeholder="Details (optional)"
        maxLength={300}
        value={f.description}
        onChange={set("description")}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-semibold">
          Regular price
          <input
            className={`${field} mt-1`}
            inputMode="decimal"
            placeholder="17.95"
            required
            value={f.regular}
            onChange={set("regular")}
          />
        </label>
        <label className="text-sm font-semibold">
          Unlock price
          <input
            className={`${field} mt-1`}
            inputMode="decimal"
            placeholder="11.00"
            required
            value={f.deal}
            onChange={set("deal")}
          />
        </label>
      </div>
      {off > 0 && (
        <p className="text-sm font-bold text-primary">That's {off}% off. Prices include tax.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-semibold">
          People needed
          <input
            className={`${field} mt-1`}
            type="number"
            min={2}
            max={500}
            required
            value={f.goal}
            onChange={set("goal")}
          />
        </label>
        <label className="text-sm font-semibold">
          Max spots
          <input
            className={`${field} mt-1`}
            type="number"
            min={2}
            max={1000}
            required
            value={f.max}
            onChange={set("max")}
          />
        </label>
      </div>
      <label className="block text-sm font-semibold">
        People can join until
        <input
          className={`${field} mt-1`}
          type="datetime-local"
          required
          value={f.ends}
          onChange={set("ends")}
        />
      </label>
      <label className="block text-sm font-semibold">
        Pickup until
        <input
          className={`${field} mt-1`}
          type="datetime-local"
          required
          value={f.pickup}
          onChange={set("pickup")}
        />
      </label>
      <p className="rounded-2xl bg-secondary p-3 text-xs text-muted-foreground">
        Customers pay at your counter when they pick up, using the code on their phone. After you
        post, the price, goal and times can't be changed, so it stays fair for everyone who joins.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="rounded-2xl shadow-none"
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button type="submit" size="lg" className="rounded-2xl" disabled={busy}>
          {busy ? "Posting…" : "Post deal"}
        </Button>
      </div>
    </form>
  );
}
