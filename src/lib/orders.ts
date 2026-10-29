import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export function useLiveOrders(filter: string | undefined, onArrival?: (id: string) => void) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!filter) return;
    const channel = supabase.channel(`orders-${crypto.randomUUID()}`).on("postgres_changes", { event: "*", schema: "public", table: "orders", filter }, payload => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (payload.eventType === "INSERT" && payload.new.status === "paid") onArrival?.(String(payload.new.id));
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [filter, qc, onArrival]);
}
export function useCustomerOrders(userId: string | undefined) {
  useLiveOrders(userId ? `user_id=eq.${userId}` : undefined);
  return useQuery({ queryKey: ["orders", "customer", userId], enabled: !!userId, refetchInterval: 30_000, queryFn: async () => {
    if (!userId) return [];
    const { data, error } = await supabase.from("orders").select("*, restaurants(name, address, slug), order_items(*)").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error; return data;
  } });
}