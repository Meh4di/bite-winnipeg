import { createFileRoute } from "@tanstack/react-router";
import { Stamp } from "lucide-react";
import { ComingSoon } from "@/components/bite/ComingSoon";

export const Route = createFileRoute("/_tabs/passport")({
  head: () => ({
    meta: [
      { title: "Passport — Bite" },
      { name: "description", content: "Collect stamps across Winnipeg restaurants and earn badges and rewards." },
      { property: "og:title", content: "Passport — Bite" },
      { property: "og:description", content: "Collect stamps, badges and rewards across Winnipeg." },
    ],
  }),
  component: () => (
    <ComingSoon
      icon={Stamp}
      emoji="🏅"
      title="Passport"
      line="Collect stamps everywhere you eat, level up, and unlock secret menus."
    />
  ),
});
