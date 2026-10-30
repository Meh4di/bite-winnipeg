import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, MapPin, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Quantity } from "@/components/bite/Quantity";
import { TabBar } from "@/components/bite/TabBar";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { pickupOptions } from "@/lib/preorders";
import { formatPrice } from "@/lib/bite";
import { supabase } from "@/integrations/supabase/client";
import { testPayment } from "@/lib/order-payment";
export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Pickup checkout — Bite" }, { name: "description", content: "Review your Bite pickup order and choose a pickup time. Test payments only." }, { property: "og:title", content: "Pickup checkout — Bite" }, { property: "og:description", content: "Your Winnipeg pickup order." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Checkout,
});
function Checkout() {
  const { cart, ready, change, clear, total } = useCart(); const { user, loading } = useAuth();
  const [note, setNote] = useState(""); const [pickup, setPickup] = useState(""); const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const navigate = useNavigate(); const qc = useQueryClient(); const rid = cart?.restaurant.id;
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(timer); }, []);
  useEffect(() => { try { const saved = JSON.parse(sessionStorage.getItem("bite-checkout") ?? "{}"); setNote(saved.note ?? ""); setPickup(saved.pickup ?? ""); } catch { /* Ignore stale form values. */ } }, []);
  const restaurant = useQuery({ queryKey: ["checkout-restaurant", rid], enabled: !!rid, refetchInterval: 15_000, queryFn: async () => {
    if (!rid) return null;
    const { data, error } = await supabase.from("restaurants").select("*").eq("id", rid).maybeSingle(); if (error) throw error; return data;
  } });
  const options = pickupOptions(restaurant.data?.hours, now);
  const selected = pickup === "asap" && options.asap ? "asap" : options.slots.some(s => s.value === pickup) ? pickup : options.asap ? "asap" : options.slots[0]?.value ?? "";
  const pay = async () => {
    if (!cart || !selected || busy) return;
    if (!user) { sessionStorage.setItem("bite-checkout", JSON.stringify({ note, pickup: selected })); navigate({ to: "/auth", search: { redirect: "/checkout" } }); return; }
    setBusy(true);
    try {
      const id = await testPayment.pay(cart, note, selected === "asap" ? null : selected);
      clear(); sessionStorage.removeItem("bite-checkout"); await qc.invalidateQueries({ queryKey: ["orders"] });
      navigate({ to: "/orders/$id", params: { id }, replace: true });
    } catch (error) { toast.error((error as Error).message); await restaurant.refetch(); }
    finally { setBusy(false); }
  };
  if (!ready) return <div className="p-6 text-muted-foreground">Loading cart…</div>;
  if (!cart) return <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center"><ShoppingBag className="size-12 text-primary" /><h1 className="text-2xl font-bold">Your cart is empty</h1><Button asChild size="xl"><Link to="/">Find a spot</Link></Button><TabBar /></div>;
  return <div className="animate-screen px-5 pb-48 pt-5">
    <header className="flex items-center gap-3"><Button variant="ghost" size="icon" className="size-11" asChild><Link to="/r/$slug" params={{ slug: cart.restaurant.slug }} aria-label="Back to menu"><ArrowLeft /></Link></Button><h1 className="text-2xl font-extrabold">Your cart</h1></header>
    <h2 className="mt-5 text-xl font-bold">{cart.restaurant.name}</h2><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" />Pickup only</p>
    <div className="mt-5 divide-y">{cart.items.map(item => <div key={item.id} className="py-4"><div className="flex gap-3">{item.photo_url && <img src={item.photo_url} alt="" className="size-16 rounded-xl object-cover" />}<div className="min-w-0 flex-1"><p className="font-semibold">{item.name}</p><p className="mt-1 text-sm text-muted-foreground">{formatPrice(item.price_cents)} each</p></div></div><div className="mt-3 flex items-center justify-between"><Quantity name={item.name} quantity={item.quantity} disabled={busy} onChange={delta => change(item.id, delta)} /><span className="font-bold">{formatPrice(item.price_cents * item.quantity)}</span></div></div>)}</div>
    <div className="mt-2 flex justify-between border-t pt-4 text-lg font-bold"><span>Total</span><span>{formatPrice(total)}</span></div><p className="pb-4 pt-1 text-xs font-semibold text-success">✅ Taxes included · No service fees · No tip screen</p>
    <label className="mt-3 block font-semibold" htmlFor="order-note">Note to the restaurant <span className="text-sm font-normal text-muted-foreground">(optional)</span></label>
    <textarea id="order-note" maxLength={1000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border bg-card p-4 outline-none focus:border-primary" placeholder="Anything we should know?" />
    <h2 className="mt-6 flex items-center gap-2 text-lg font-bold"><Clock className="size-5 text-primary" />Pickup time</h2>
    {restaurant.isLoading ? <p className="mt-2 text-muted-foreground">Checking pickup times…</p> : restaurant.error ? <p className="mt-2 text-destructive">Couldn’t load pickup times.</p> : !restaurant.data?.accepting_orders ? <p className="mt-2 font-semibold text-muted-foreground">Not taking orders right now</p> : <>
      {!options.asap && options.slots.length > 0 && <p className="mt-2 text-sm text-muted-foreground">Schedule for the next opening day.</p>}
      {selected ? <select aria-label="Pickup time" value={selected} disabled={busy} onChange={e => setPickup(e.target.value)} className="mt-3 h-13 w-full rounded-2xl border bg-card px-3 text-base">{options.asap && <option value="asap">ASAP (about 15 min)</option>}{options.slots.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select> : <p className="mt-2 text-muted-foreground">No pickup times available.</p>}
      {restaurant.data.address && <p className="mt-3 text-sm text-muted-foreground">{restaurant.data.address}, Winnipeg</p>}
    </>}
    <div className="fixed inset-x-0 bottom-[calc(4rem+max(env(safe-area-inset-bottom),0.5rem))] z-30 mx-auto max-w-[430px] border-t bg-background/95 p-4 backdrop-blur-xl"><p className="mb-2 text-center text-xs text-muted-foreground">Test mode — no real charge</p><Button size="xl" className="w-full" onClick={pay} disabled={busy || loading || !selected || !restaurant.data?.accepting_orders}>{busy ? "Placing your order…" : user ? `Pay ${formatPrice(total)} (test mode)` : "Sign in to checkout"}</Button></div>
    <TabBar />
  </div>;
}