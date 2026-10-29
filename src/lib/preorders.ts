export type CartItem = { id: string; name: string; price_cents: number; quantity: number; photo_url?: string | null };
export type Cart = { restaurant: { id: string; name: string; slug: string }; items: CartItem[]; checkoutId: string };
export function cartTotal(items: CartItem[]) { return items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0); }
export function cartCount(items: CartItem[]) { return items.reduce((sum, item) => sum + item.quantity, 0); }
export function changeQuantity(items: CartItem[], id: string, delta: number) {
  return items.map(item => item.id === id ? { ...item, quantity: Math.min(99, item.quantity + delta) } : item).filter(item => item.quantity > 0);
}
export function needsCartReset(cart: Cart | null, restaurantId: string) { return !!cart?.items.length && cart.restaurant.id !== restaurantId; }
export const ORDER_STEPS = ["paid", "preparing", "ready", "picked_up"] as const;
export const STATUS_LABELS: Record<string, string> = { pending: "Pending", paid: "Paid", preparing: "Preparing", ready: "Ready for pickup", picked_up: "Picked up", cancelled: "Cancelled" };
export function nextOrderStatus(status: string) { const index = ORDER_STEPS.findIndex(step => step === status); return index >= 0 ? ORDER_STEPS[index + 1] : undefined; }
export function pickupLabel(value: string | null) { return value ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Winnipeg", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "Not scheduled"; }
type Hours = Partial<Record<string, { open?: string; close?: string; closed?: boolean }>>;
const localFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Winnipeg", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function local(date: Date) {
  const parts = localFormatter.formatToParts(date);
  const get = (key: string) => parts.find(p => p.type === key)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, day: get("weekday").toLowerCase().slice(0, 3), time: `${get("hour")}:${get("minute")}` };
}
export function pickupOptions(hours: unknown, now = new Date()) {
  const schedule = (hours ?? {}) as Hours;
  const here = local(now);
  const h = schedule[here.day];
  const soon = local(new Date(now.getTime() + 15 * 60_000));
  const asap = !!h?.open && !!h.close && !h.closed && here.time >= h.open && here.time < h.close && soon.date === here.date && soon.time < h.close;
  const slots: { value: string; label: string }[] = [];
  let chosenDay = "";
  const start = Math.ceil((now.getTime() + 15 * 60_000) / (15 * 60_000)) * 15 * 60_000;
  for (let time = start; time < now.getTime() + 8 * 86400_000; time += 15 * 60_000) {
    const date = new Date(time); const p = local(date); const dayHours = schedule[p.day];
    if (!dayHours?.open || !dayHours.close || dayHours.closed || p.time < dayHours.open || p.time >= dayHours.close) continue;
    if (!chosenDay) chosenDay = p.date;
    if (p.date !== chosenDay) break;
    slots.push({ value: date.toISOString(), label: pickupLabel(date.toISOString()) });
  }
  return { asap, slots };
}