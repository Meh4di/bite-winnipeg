import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TabBar } from "@/components/bite/TabBar";

export const Route = createFileRoute("/_tabs")({
  component: TabsLayout,
});

function TabsLayout() {
  return (
    <div className="pb-24">
      <Outlet />
      <TabBar />
    </div>
  );
}
