import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock, MapPin, ShoppingBag } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCustomerOrders } from "@/lib/orders";
import { ORDER_STEPS, STATUS_LABELS, pickupLabel } from "@/lib/preorders";
import { formatPrice } from "@/lib/bite";
import { Button } from "@/components/ui/button";
import { TabBar } from "@/components/bite/TabBar";
export const Route = createFileRoute("/orders/$id")({
  head: () => ({ meta: [{ title: "Track your pickup — Bite" }, { name: "description", content: "Follow your Bite order from paid to ready for pickup." }, { property: "og:title", content: "Track your pickup — Bite" }, { property: "og:description", content: "Your pickup order status on Bite." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: OrderTracking,
});
function OrderTracking() {
  const { id } = Route.useParams(); const { user, loading } = useAuth(); const orders = useCustomerOrders(user?.id);
  const order = orders.data?.find(o => o.id === id);
  if (loading || (user && orders.isLoading)) return <p className="p-6 text-muted-foreground">Loading your order…</p>;
  if (!user) return <div className="p-6"><h1 className="text-2xl font-bold">Your pickup order</h1><Button asChild size="xl" className="mt-5 w-full"><Link to="/auth" search={{ redirect: `/orders/${id}` }}>Sign in to view your order</Link></Button></div>;
  if (!order) return <div className="p-6"><h1 className="text-2xl font-bold">{orders.error ? "Couldn’t load your order" : "Order unavailable"}</h1><Button asChild variant="outline" className="mt-4"><Link to="/profile">Back to Profile</Link></Button></div>;
  const current = ORDER_STEPS.findIndex(step => step === order.status);
  return <div className="animate-screen px-5 pb-28 pt-8">
    <p className="text-sm font-semibold text-primary">{order.restaurants?.name}</p><h1 className="mt-2 text-3xl font-extrabold">{order.status === "ready" ? "Your bite is ready!" : order.status === "picked_up" ? "Enjoy every bite." : "Good food is on its way."}</h1>
    <p className="mt-2 text-lg font-bold">Order #{order.order_number}</p>
    <div className="mt-7 space-y-0" aria-label="Order status">{ORDER_STEPS.map((step, index) => <div key={step} className="flex min-h-20 gap-4"><div className="flex w-11 flex-col items-center"><span className={`grid size-11 shrink-0 place-items-center rounded-full ${index <= current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index < current ? <Check className="size-6" /> : index + 1}</span>{index < 3 && <span className={`min-h-9 w-0.5 flex-1 ${index < current ? "bg-primary" : "bg-border"}`} />}</div><div className="pt-2"><p className={`text-lg font-bold ${index <= current ? "text-foreground" : "text-muted-foreground"}`}>{STATUS_LABELS[step]}</p>{index === current && <p className="text-sm text-primary">{step === "paid" ? "Order received" : step === "preparing" ? "The kitchen is on it" : step === "ready" ? "Head over to pick it up" : "Thanks for ordering"}</p>}</div></div>)}</div>
    {order.status === "cancelled" && <p className="text-destructive">This order was cancelled.</p>}
    <div className="mt-6 space-y-4 border-y py-5"><div className="flex gap-3"><Clock className="size-5 shrink-0 text-primary" /><div><p className="text-sm text-muted-foreground">Pickup time</p><p className="font-semibold">{pickupLabel(order.pickup_time)}</p></div></div><div className="flex gap-3"><MapPin className="size-5 shrink-0 text-primary" /><div><p className="font-semibold">{order.restaurants?.name}</p><p className="text-sm text-muted-foreground">{order.restaurants?.address ?? "Address not provided"}, Winnipeg</p></div></div></div>
    <h2 className="mt-6 flex items-center gap-2 text-xl font-bold"><ShoppingBag className="size-5" />Your order</h2><div className="mt-3 space-y-3">{order.order_items.map(item => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.quantity} × {item.item_name}</span><span className="shrink-0 font-semibold">{formatPrice(item.price_cents * item.quantity)}</span></div>)}</div>
    {order.note && <p className="mt-4 rounded-xl bg-secondary p-3 text-sm">{order.note}</p>}<div className="mt-4 flex justify-between border-t pt-4 font-bold"><span>Total paid</span><span>{formatPrice(order.total_cents)}</span></div><p className="mt-2 text-xs text-muted-foreground">Test mode — no real charge</p>
    <Button asChild size="xl" variant="outline" className="mt-6 w-full"><Link to="/profile">All my orders</Link></Button><TabBar />
  </div>;
}