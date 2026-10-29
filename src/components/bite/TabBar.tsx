import { Link } from "@tanstack/react-router";
import { Home, Zap, Stamp, Users, User } from "lucide-react";
import { useVortex } from "@/lib/weather";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/drops", label: "Drops", icon: Zap },
  { to: "/social", label: "Social", icon: Users },
  { to: "/passport", label: "Passport", icon: Stamp },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function TabBar() {
  useVortex(); // keeps Polar Vortex mode in sync on every screen
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[700] mx-auto max-w-[430px] border-t bg-background/95 backdrop-blur-xl pb-safe">
      <ul className="grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: true, includeSearch: false }}
              className="group flex h-16 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <span className="grid h-8 w-14 place-items-center transition-all group-active:scale-90">
                <Icon
                  className="size-[23px] group-data-[status=active]:fill-primary/15"
                  strokeWidth={2.2}
                />
              </span>
              <span className="text-[11px] font-semibold group-data-[status=active]:font-extrabold">
                {label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
