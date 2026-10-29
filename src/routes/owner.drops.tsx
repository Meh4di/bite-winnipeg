import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Flame, Megaphone, Package, Snowflake, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ImagePick } from "@/components/bite/ImagePick";
import { formatPrice } from "@/lib/bite";
import { clockTime, dropState, useNow } from "@/lib/live";
import { Route as OwnerRoute, useMyRestaurant } from "./owner";

export const Route = createFileRoute("/owner/drops")({
  head: () => ({
    meta: [
      { title: "Drops & deals — Bite Business" },
      { name: "description", content: "Post limited drops, last-call deals and promotions." },
      { property: "og:title", content: "Drops & deals — Bite Business" },
      { property: "og:description", content: "Post drops and deals on Bite." },
    ],
  }),
  component: OwnerDrops,
});

const field =
  "h-12 w-full rounded-2xl border bg-background px-4 text-base outline-none focus:border-primary";

/** datetime-local value for a Date, in the device's time zone. */
function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function roundUp(d: Date, minutes: number) {
  const ms = minutes * 60_000;
  return new Date(Math.ceil(d.getTime() / ms) * ms);
}

type Kind = "drop" | "leftover" | "promo" | "vortex";
type Draft = {
  kind: Kind;
  title: string;
  description: string;
  photo_url: string | null;
  price: string;
  original: string;
  quantity: string;
  code: string;
  unlock: string;
  starts: string;
  ends: string;
};

function newDraft(kind: Kind): Draft {
  const now = new Date();
  const start = kind === "drop" ? roundUp(new Date(now.getTime() + 30 * 60_000), 15) : now;
  const end =
    kind === "drop"
      ? new Date(start.getTime() + 2 * 3600_000)
      : kind === "leftover"
        ? roundUp(new Date(now.getTime() + 90 * 60_000), 15)
        : new Date(now.getTime() + (kind === "vortex" ? 120 : 7) * 86400_000);
  return {
    kind,
    title: "",
    description: "",
    photo_url: null,
    price: "",
    original: "",
    quantity: kind === "leftover" ? "5" : "25",
    code: "",
    unlock: "-25",
    starts: localInput(start),
    ends: localInput(end),
  };
}

const KIND_INFO: Record<Kind, { title: string; line: string; icon: typeof Flame }> = {
  drop: { title: "Drop", line: "A limited item released at a set time. Builds hype.", icon: Flame },
  leftover: {
    title: "Save food",
    line: "Food that would be thrown out, 60–70% off. Customers pick it up before you close.",
    icon: Package,
  },
  promo: { title: "Promotion", line: "A deal or code shown in the Deals feed.", icon: Megaphone },
  vortex: {
    title: "Vortex deal",
    line: "Unlocks only when Winnipeg feels like -25°C or colder. Post bigger ones for -30 and -35.",
    icon: Snowflake,
  },
};

function OwnerDrops() {
  const { userId } = OwnerRoute.useRouteContext();
  const { data: r } = useMyRestaurant();
  const qc = useQueryClient();
  const now = useNow(15_000);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const data = useQuery({
    queryKey: ["owner-drops", r?.id],
    enabled: !!r,
    refetchInterval: 20_000,
    queryFn: async () => {
      if (!r) return { drops: [], promos: [], claims: new Map<string, number>() };
      const [drops, promos, claims] = await Promise.all([
        supabase
          .from("drops")
          .select("*")
          .eq("restaurant_id", r.id)
          .order("starts_at", { ascending: false })
          .limit(50),
        supabase
          .from("promotions")
          .select("*")
          .eq("restaurant_id", r.id)
          .order("starts_at", { ascending: false })
          .limit(50),
        supabase
          .from("orders")
          .select("drop_id")
          .eq("restaurant_id", r.id)
          .not("drop_id", "is", null)
          .neq("status", "cancelled"),
      ]);
      if (drops.error) throw drops.error;
      const counts = new Map<string, number>();
      for (const o of claims.data ?? [])
        if (o.drop_id) counts.set(o.drop_id, (counts.get(o.drop_id) ?? 0) + 1);
      return { drops: drops.data ?? [], promos: promos.data ?? [], claims: counts };
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["owner-drops"] });
    qc.invalidateQueries({ queryKey: ["drops"] });
    qc.invalidateQueries({ queryKey: ["promotions"] });
  };

  if (!r)
    return (
      <div className="p-8 text-center">
        <p>Set up your restaurant first.</p>
        <Link to="/owner/setup" className="font-semibold text-primary">
          Go to setup
        </Link>
      </div>
    );

  const save = async () => {
    if (!draft) return;
    const starts = new Date(draft.starts);
    const ends = draft.ends ? new Date(draft.ends) : null;
    if (!draft.title.trim()) {
      toast.error("Add a title");
      return;
    }
    if (Number.isNaN(starts.getTime())) {
      toast.error("Pick a start time");
      return;
    }
    if (ends && ends <= starts) {
      toast.error("End time must be after the start");
      return;
    }
    setSaving(true);
    try {
      if (draft.kind === "promo" || draft.kind === "vortex") {
        const { error } = await supabase.from("promotions").insert({
          restaurant_id: r.id,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          photo_url: draft.photo_url,
          promo_code: draft.code.trim().toUpperCase() || null,
          vortex_only: draft.kind === "vortex",
          unlock_temp_c: draft.kind === "vortex" ? Number(draft.unlock) : -25,
          starts_at: starts.toISOString(),
          ends_at: ends?.toISOString() ?? null,
        });
        if (error) throw error;
      } else {
        const price = Math.round(parseFloat(draft.price || "0") * 100);
        const original = draft.original ? Math.round(parseFloat(draft.original) * 100) : null;
        const qty = parseInt(draft.quantity, 10);
        if (!(price >= 0)) throw new Error("Enter a price");
        if (!(qty >= 1 && qty <= 1000)) throw new Error("Quantity must be between 1 and 1000");
        if (draft.kind === "leftover") {
          if (!original || original <= 0) throw new Error("Enter the regular price");
          if (price * 2 > original) throw new Error("Save-food deals need to be at least 50% off (60–70% works best)");
        }
        const { error } = await supabase.from("drops").insert({
          restaurant_id: r.id,
          kind: draft.kind,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          photo_url: draft.photo_url,
          price_cents: price,
          original_price_cents: draft.kind === "leftover" ? original : null,
          quantity_total: qty,
          starts_at: starts.toISOString(),
          ends_at: ends?.toISOString() ?? null,
        });
        if (error) throw error;
      }
      toast.success(
        draft.kind === "promo" || draft.kind === "vortex" ? "Posted" : "Posted! It's in the Drops feed.",
      );
      setDraft(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const endDrop = async (id: string, startsAt: string) => {
    const end = new Date(Math.max(Date.now(), new Date(startsAt).getTime() + 1000)).toISOString();
    const { error } = await supabase.from("drops").update({ ends_at: end }).eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  };
  const donate = async (id: string, left: number) => {
    const to = prompt(`Donate the ${left} left to which food bank or shelter?`, "Local food bank");
    if (to === null) return;
    const { data: n, error } = await supabase.rpc("donate_leftover", { p_drop_id: id, p_recipient: to });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Logged ${n} meals donated. Thank you 💚`);
    refresh();
    qc.invalidateQueries({ queryKey: ["city-impact"] });
  };
  const delDrop = async (id: string) => {
    if (!confirm("Delete this? Anyone who already claimed it keeps their order.")) return;
    const { error } = await supabase.from("drops").delete().eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  };
  const endPromo = async (id: string, startsAt: string) => {
    const end = new Date(Math.max(Date.now(), new Date(startsAt).getTime() + 1000)).toISOString();
    const { error } = await supabase.from("promotions").update({ ends_at: end }).eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  };

  const drops = data.data?.drops ?? [];
  const active = drops.filter((d) => ["live", "upcoming", "soldout"].includes(dropState(d, now)));
  const past = drops.filter((d) => dropState(d, now) === "ended");
  const promos = data.data?.promos ?? [];
  const promoActive = promos.filter((p) => !p.ends_at || new Date(p.ends_at).getTime() > now);

  return (
    <div className="space-y-6 px-5 pt-5 animate-screen">
      <div>
        <h1 className="text-2xl font-extrabold">Drops & deals</h1>
        <p className="text-sm text-muted-foreground">
          Bring people in on slow hours and sell what's left at close.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(KIND_INFO) as Kind[]).map((k) => {
          const Icon = KIND_INFO[k].icon;
          return (
            <button
              key={k}
              onClick={() => setDraft(newDraft(k))}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 shadow-card active:scale-95"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" />
              </span>
              <span className="text-sm font-bold">+ {KIND_INFO[k].title}</span>
            </button>
          );
        })}
      </div>

      <section>
        <h2 className="mb-2 text-lg font-bold">Live & upcoming</h2>
        {active.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-card">
            Nothing scheduled. Try a drop for your slowest hour, like 2–4pm.
          </p>
        )}
        <div className="space-y-2">
          {active.map((d) => {
            const st = dropState(d, now);
            return (
              <div key={d.id} className="rounded-2xl bg-card p-3 shadow-card">
                <div className="flex items-start gap-3">
                  {d.photo_url ? (
                    <img src={d.photo_url} alt="" className="size-14 rounded-xl object-cover" />
                  ) : (
                    <div className="grid size-14 place-items-center rounded-xl bg-muted text-2xl">
                      {d.kind === "leftover" ? "🥡" : "🔥"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">
                      {d.kind === "leftover" ? "Last call" : "Drop"} ·{" "}
                      {st === "upcoming"
                        ? `starts ${clockTime(d.starts_at)}`
                        : st === "soldout"
                          ? "sold out"
                          : "live"}
                    </p>
                    <p className="truncate font-semibold">{d.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(d.price_cents)} · {d.quantity_total - d.quantity_left}/
                      {d.quantity_total} claimed
                      {d.ends_at ? ` · until ${clockTime(d.ends_at)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {st !== "upcoming" && (
                    <Button
                      variant="secondary"
                      className="h-10 flex-1"
                      onClick={() => endDrop(d.id, d.starts_at)}
                    >
                      End now
                    </Button>
                  )}
                  {d.kind === "leftover" && st === "live" && d.quantity_left > 0 && (
                    <Button
                      variant="secondary"
                      className="h-10 flex-1 text-success"
                      onClick={() => donate(d.id, d.quantity_left)}
                    >
                      💚 Donate the rest
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="h-10 text-destructive"
                    onClick={() => delDrop(d.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Promotions</h2>
        {promoActive.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-card">
            No promotions running.
          </p>
        )}
        <div className="space-y-2">
          {promoActive.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
              <Megaphone className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.title}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(p.starts_at).getTime() > now
                    ? `Starts ${clockTime(p.starts_at)}`
                    : "Running"}
                  {p.promo_code ? ` · ${p.promo_code}` : ""}
                  {p.ends_at ? ` · until ${clockTime(p.ends_at)}` : ""}
                </p>
              </div>
              <Button
                variant="secondary"
                className="h-10"
                onClick={() => endPromo(p.id, p.starts_at)}
              >
                End
              </Button>
            </div>
          ))}
        </div>
      </section>

      {past.length > 0 && (
        <details className="rounded-2xl bg-card p-4 shadow-card">
          <summary className="cursor-pointer font-semibold">Past drops ({past.length})</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {past.map((d) => (
              <li key={d.id} className="flex justify-between gap-3">
                <span className="truncate">{d.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {data.data?.claims.get(d.id) ?? 0}/{d.quantity_total} claimed
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40"
          onClick={() => setDraft(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-[430px] space-y-3 overflow-y-auto rounded-t-3xl bg-card p-5 pb-safe animate-screen"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold">New {KIND_INFO[draft.kind].title.toLowerCase()}</h3>
            <p className="-mt-2 text-sm text-muted-foreground">{KIND_INFO[draft.kind].line}</p>
            <ImagePick
              bucket="menu-photos"
              userId={userId}
              value={draft.photo_url}
              onChange={(u) => setDraft({ ...draft, photo_url: u })}
              label="Photo (makes it pop)"
              className="h-36 w-full"
            />
            <input
              className={field}
              maxLength={80}
              placeholder={
                draft.kind === "vortex"
                  ? "e.g. Free hot chocolate with any soup"
                  : draft.kind === "promo"
                  ? "e.g. 2-for-1 lattes until 3pm"
                  : draft.kind === "leftover"
                    ? "e.g. Surprise pastry box"
                    : "e.g. Birria tacos (only 50!)"
              }
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <textarea
              className="min-h-20 w-full rounded-2xl border bg-background p-4 text-base outline-none focus:border-primary"
              maxLength={300}
              placeholder="Description (optional)"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            {draft.kind === "promo" || draft.kind === "vortex" ? (
              <div className="space-y-2">
                <input
                  className={`${field} font-mono uppercase`}
                  maxLength={20}
                  placeholder="Promo code (optional)"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                />
                {draft.kind === "vortex" && (
                  <label className="block text-sm font-semibold">
                    Unlocks when it feels like
                    <select
                      className={`${field} mt-1`}
                      value={draft.unlock}
                      onChange={(e) => setDraft({ ...draft, unlock: e.target.value })}
                    >
                      <option value="-25">-25°C or colder</option>
                      <option value="-30">-30°C or colder (bigger deal)</option>
                      <option value="-35">-35°C or colder (biggest deal)</option>
                      <option value="-40">-40°C (legendary)</option>
                    </select>
                  </label>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {draft.kind === "leftover" && (
                  <label className="text-sm font-semibold">
                    Regular price
                    <input
                      className={`${field} mt-1`}
                      inputMode="decimal"
                      placeholder="12.00"
                      value={draft.original}
                      onChange={(e) => {
                        const original = e.target.value;
                        const o = parseFloat(original);
                        setDraft({ ...draft, original, price: o > 0 ? (Math.round(o * 35) / 100).toFixed(2) : draft.price });
                      }}
                    />
                  </label>
                )}
                <label className="text-sm font-semibold">
                  {draft.kind === "leftover" ? "Deal price" : "Price"}
                  <input
                    className={`${field} mt-1`}
                    inputMode="decimal"
                    placeholder={draft.kind === "leftover" ? "4.20" : "6.00"}
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  />
                </label>
                {draft.kind === "leftover" && parseFloat(draft.original) > 0 && parseFloat(draft.price) >= 0 && (
                  <p
                    className={`col-span-2 -mt-1 text-sm font-bold ${
                      parseFloat(draft.price) * 2 <= parseFloat(draft.original) ? "text-success" : "text-destructive"
                    }`}
                  >
                    {Math.round((1 - parseFloat(draft.price) / parseFloat(draft.original)) * 100)}% off
                    {parseFloat(draft.price) * 2 <= parseFloat(draft.original) ? " ✓" : " · needs to be at least 50% off"}
                  </p>
                )}
                {draft.kind === "leftover" ? null : (
                  <label className="text-sm font-semibold">
                    How many
                    <input
                      className={`${field} mt-1`}
                      inputMode="numeric"
                      value={draft.quantity}
                      onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                    />
                  </label>
                )}
                {draft.kind === "leftover" && (
                  <label className="col-span-2 text-sm font-semibold">
                    How many
                    <input
                      className={`${field} mt-1`}
                      inputMode="numeric"
                      value={draft.quantity}
                      onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                    />
                  </label>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm font-semibold">
                Starts
                <input
                  type="datetime-local"
                  className={`${field} mt-1 px-2 text-sm`}
                  value={draft.starts}
                  onChange={(e) => setDraft({ ...draft, starts: e.target.value })}
                />
              </label>
              <label className="text-sm font-semibold">
                {draft.kind === "leftover" ? "Pick up by" : "Ends"}
                <input
                  type="datetime-local"
                  className={`${field} mt-1 px-2 text-sm`}
                  value={draft.ends}
                  onChange={(e) => setDraft({ ...draft, ends: e.target.value })}
                />
              </label>
            </div>
            <Button size="xl" className="w-full" disabled={saving} onClick={save}>
              {saving ? "Posting…" : "Post it"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
