import { Link } from "@tanstack/react-router";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCustomerOrders } from "@/lib/orders";
import { STATUS_LABELS, pickupLabel } from "@/lib/preorders";
import { formatPrice } from "@/lib/bite";
export function OrderHistory() {
  const { user } = useAuth(); const orders = useCustomerOrders(user?.id);
  const active = orders.data?.filter(o => !["picked_up", "cancelled"].includes(o.status)) ?? [];
  const past = orders.data?.filter(o => ["picked_up", "cancelled"].includes(o.status)) ?? [];
  return <section className="mt-7">
    <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><ShoppingBag className="size-5 text-primary" />Orders</h2>
    {orders.isLoading && <p className="text-muted-foreground">Loading orders…</p>}
    {orders.error && <p className="text-destructive">Couldn’t load orders. Try again shortly.</p>}
    {!orders.isLoading && !orders.error && !orders.data?.length && <p className="text-sm text-muted-foreground">No orders yet.</p>}
    {[{ title: "Active", items: active }, { title: "Past orders", items: past }].map(group => group.items.length > 0 && <div key={group.title} className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{group.title}</h3>
      {group.items.map(order => <Link key={order.id} to="/orders/$id" params={{ id: order.id }} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
        <div className="min-w-0 flex-1"><p className="font-bold">{order.restaurants?.name ?? "Restaurant"}</p><p className="mt-1 text-sm text-primary">#{order.order_number} · {STATUS_LABELS[order.status]}</p><p className="mt-1 text-xs text-muted-foreground">{pickupLabel(order.pickup_time)}</p></div>
        <span className="font-semibold">{formatPrice(order.total_cents)}</span><ChevronRight className="size-4 shrink-0" />
      </Link>)}
    </div>)}
  </section>;
}