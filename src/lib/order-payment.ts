import { supabase } from "@/integrations/supabase/client";
import type { Cart } from "./preorders";
// Payment boundary: replace this adapter with a Stripe checkout session and verified webhook.
export const testPayment = {
  async pay(cart: Cart, note: string, pickupTime: string | null) {
    const { data, error } = await supabase.rpc("checkout_test_order", { p_order_id: cart.checkoutId, p_restaurant_id: cart.restaurant.id, p_items: cart.items.map(i => ({ id: i.id, quantity: i.quantity })), p_note: note, ...(pickupTime ? { p_pickup_time: pickupTime } : {}) });
    if (error) throw error;
    return data;
  },
};