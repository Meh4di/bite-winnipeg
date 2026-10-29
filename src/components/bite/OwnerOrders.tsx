import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useLiveOrders } from "@/lib/orders";
import { nextOrderStatus, pickupLabel } from "@/lib/preorders";
import { formatPrice } from "@/lib/bite";
export function OwnerOrders({ restaurant }: { restaurant: { id: string; accepting_orders: boolean } }) {
  const [tab, setTab] = useState<"paid" | "preparing" | "ready">("paid"); const [highlight, setHighlight] = useState<string | null>(null); const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null); const qc = useQueryClient();
  useEffect(() => () => { void audio.current?.close(); }, []);
  useEffect(() => { if (!highlight) return; const timer = setTimeout(() => setHighlight(null), 12_000); return () => clearTimeout(timer); }, [highlight]);
  const arrival = useCallback((id: string) => {
    setHighlight(id); setTab("paid"); toast.success("New pickup order!", { icon: <Bell className="size-4" /> });
    if (!audio.current || audio.current.state !== "running") return;
    const ctx = audio.current; const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.frequency.setValueAtTime(880, ctx.currentTime); oscillator.frequency.setValueAtTime(1174, ctx.currentTime + 0.12); gain.gain.setValueAtTime(0.12, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4); oscillator.start(); oscillator.stop(ctx.currentTime + 0.4);
  }, []);
  useLiveOrders(`restaurant_id=eq.${restaurant.id}`, arrival);
  const orders = useQuery({ queryKey: ["orders", "owner", restaurant.id], refetchInterval: 15_000, queryFn: async () => {
    const { data, error } = await supabase.from("orders").select("*, order_items(*)").eq("restaurant_id", restaurant.id).in("status", ["paid", "preparing", "ready"]).order("pickup_time");
    if (error) throw error; return data;
  } });
  const accepting = useMutation({ mutationFn: async (value: boolean) => { const { error } = await supabase.from("restaurants").update({ accepting_orders: value }).eq("id", restaurant.id); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-restaurant"] }); qc.invalidateQueries({ queryKey: ["restaurant"] }); qc.invalidateQueries({ queryKey: ["checkout-restaurant"] }); }, onError: error => toast.error(error.message) });
  const update = useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => {
    const next = nextOrderStatus(status); if (!next) return;
    const { data, error } = await supabase.from("orders").update({ status: next }).eq("id", id).eq("restaurant_id", restaurant.id).eq("status", status).select("id");
    if (error) throw error; if (!data?.length) throw new Error("Order changed. Refresh and try again.");
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }), onError: error => toast.error(error.message) });
  const toggleSound = async () => { if (sound) { await audio.current?.suspend(); setSound(false); } else { try { if (!audio.current) audio.current = new AudioContext(); await audio.current.resume(); setSound(true); } catch { toast.error("Sound isn’t available on this device."); } } };
  return <section className="mt-5">
    <div className="flex items-center justify-between gap-3 border-y py-4"><label htmlFor="accepting-orders" className="font-semibold">Accepting orders<p className="mt-1 text-xs font-normal text-muted-foreground">{restaurant.accepting_orders ? "Pickup orders are on" : "Orders are paused"}</p></label><Switch id="accepting-orders" checked={restaurant.accepting_orders} disabled={accepting.isPending} onCheckedChange={value => accepting.mutate(value)} /></div>
    <div className="mt-5 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-bold"><ShoppingBag className="size-5 text-primary" />Orders</h2><Button variant="ghost" size="icon" className="size-11" title={sound ? "Mute order alerts" : "Enable order sound"} aria-label={sound ? "Mute order alerts" : "Enable order sound"} onClick={toggleSound}>{sound ? <Volume2 /> : <VolumeX />}</Button></div>
    <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1" role="tablist" aria-label="Order queues">{([['paid', 'New'], ['preparing', 'Preparing'], ['ready', 'Ready']] as const).map(([status, label]) => <Button key={status} role="tab" aria-selected={tab === status} variant={tab === status ? "default" : "ghost"} className="h-12 px-1" onClick={() => setTab(status)}>{label} <span className="text-xs">{orders.data?.filter(o => o.status === status).length ?? 0}</span></Button>)}</div>
    {orders.isLoading && <p className="py-8 text-center text-muted-foreground">Loading orders…</p>}{orders.error && <p className="py-8 text-center text-destructive">Couldn’t load orders.</p>}
    {!orders.isLoading && !orders.error && !orders.data?.some(o => o.status === tab) && <div className="py-10 text-center"><ShoppingBag className="mx-auto size-9 text-muted-foreground" /><p className="mt-3 font-semibold">{tab === "paid" ? "No new orders" : tab === "preparing" ? "Nothing preparing" : "No orders ready"}</p></div>}
    <div className="mt-4 space-y-4">{orders.data?.filter(order => order.status === tab).map(order => <article key={order.id} className={`rounded-2xl border bg-card p-4 shadow-card ${highlight === order.id ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
      <div className="flex justify-between gap-3"><div><h3 className="text-xl font-extrabold">#{order.order_number}</h3><p className="mt-1 font-semibold">{order.customer_name}</p></div><span className="font-bold text-primary">{formatPrice(order.total_cents)}</span></div>
      <p className="mt-3 rounded-xl bg-primary-soft p-3 text-sm font-semibold text-primary">Pickup · {pickupLabel(order.pickup_time)}</p>
      <ul className="mt-4 space-y-2 text-sm">{order.order_items.map(item => <li key={item.id} className="flex gap-2"><span className="font-bold">{item.quantity}×</span><span>{item.item_name}</span></li>)}</ul>
      {order.note && <p className="mt-3 rounded-xl bg-secondary p-3 text-sm"><span className="font-semibold">Note: </span>{order.note}</p>}
      <Button size="xl" className="mt-4 w-full" disabled={update.isPending} onClick={() => update.mutate({ id: order.id, status: order.status })}>{update.isPending && update.variables?.id === order.id ? "Updating…" : order.status === "paid" ? "Start preparing" : order.status === "preparing" ? "Mark ready" : "Picked up"}</Button>
    </article>)}</div>
  </section>;
}