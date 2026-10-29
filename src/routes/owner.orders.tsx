import { createFileRoute } from "@tanstack/react-router";
import { useMyRestaurant } from "./owner";
import { OwnerOrders } from "@/components/bite/OwnerOrders";
export const Route = createFileRoute("/owner/orders")({
  head: () => ({ meta: [{ title: "Pickup orders — Bite Business" }, { name: "description", content: "Manage live incoming pickup orders for your restaurant." }, { property: "og:title", content: "Pickup orders — Bite Business" }, { property: "og:description", content: "Your restaurant pickup queue." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Orders,
});
function Orders() { const { data, isLoading } = useMyRestaurant(); return <div className="px-5 pt-5"><h1 className="text-2xl font-extrabold">Pickup orders</h1>{data ? <OwnerOrders restaurant={data} /> : <p className="mt-4 text-muted-foreground">{isLoading ? "Loading…" : "Set up your restaurant to receive orders."}</p>}</div>; }