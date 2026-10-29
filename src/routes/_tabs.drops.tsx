import { createFileRoute } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { ComingSoon } from "@/components/bite/ComingSoon";

export const Route = createFileRoute("/_tabs/drops")({
  head: () => ({
    meta: [
      { title: "Drops — Bite" },
      { name: "description", content: "Limited-quantity items from Winnipeg restaurants, released at a set time." },
      { property: "og:title", content: "Drops — Bite" },
      { property: "og:description", content: "Limited-quantity food drops from Winnipeg spots." },
    ],
  }),
  component: () => (
    <ComingSoon
      icon={Zap}
      emoji="⏰"
      title="Drops"
      line="Limited-run treats released at a set time. Claim yours before they're gone."
    />
  ),
});
