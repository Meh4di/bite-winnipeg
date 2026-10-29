import { createFileRoute } from "@tanstack/react-router";
import { Dices } from "lucide-react";
import { ComingSoon } from "@/components/bite/ComingSoon";

export const Route = createFileRoute("/_tabs/decide")({
  head: () => ({
    meta: [
      { title: "Decide — Bite" },
      { name: "description", content: "Swipe with friends or spin the roulette to pick where to eat in Winnipeg." },
      { property: "og:title", content: "Decide — Bite" },
      { property: "og:description", content: "Swipe with friends to pick a restaurant." },
    ],
  }),
  component: () => (
    <ComingSoon
      icon={Dices}
      emoji="🎡"
      title="Decide"
      line="Can't choose? Swipe with friends or spin the roulette and let fate pick."
    />
  ),
});
