import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cartCount, cartTotal, changeQuantity, needsCartReset, type Cart, type CartItem } from "./preorders";
type CartContext = { cart: Cart | null; ready: boolean; add: (restaurant: Cart["restaurant"], item: Omit<CartItem, "quantity">) => void; change: (id: string, delta: number) => void; clear: () => void; count: number; total: number };
const Context = createContext<CartContext | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const stored = localStorage.getItem("bite-cart"); if (stored) { const parsed = JSON.parse(stored); if (parsed?.restaurant?.id && Array.isArray(parsed.items) && parsed.checkoutId) setCart(parsed); } } catch { localStorage.removeItem("bite-cart"); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) { if (cart) localStorage.setItem("bite-cart", JSON.stringify(cart)); else localStorage.removeItem("bite-cart"); } }, [cart, ready]);
  const add: CartContext["add"] = (restaurant, item) => {
    if (needsCartReset(cart, restaurant.id) && !window.confirm(`Clear your cart from ${cart?.restaurant.name} and start a new order at ${restaurant.name}?`)) return;
    setCart(current => {
      if (!current || current.restaurant.id !== restaurant.id) return { restaurant, items: [{ ...item, quantity: 1 }], checkoutId: crypto.randomUUID() };
      const exists = current.items.some(i => i.id === item.id);
      return { ...current, checkoutId: crypto.randomUUID(), items: exists ? changeQuantity(current.items, item.id, 1) : [...current.items, { ...item, quantity: 1 }] };
    });
  };
  const change = (id: string, delta: number) => setCart(current => { if (!current) return null; const items = changeQuantity(current.items, id, delta); return items.length ? { ...current, checkoutId: crypto.randomUUID(), items } : null; });
  return <Context.Provider value={{ cart, ready, add, change, clear: () => setCart(null), count: cartCount(cart?.items ?? []), total: cartTotal(cart?.items ?? []) }}>{children}</Context.Provider>;
}
export function useCart() { const context = useContext(Context); if (!context) throw new Error("Cart provider missing"); return context; }