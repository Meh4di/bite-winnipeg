import { Link } from "@tanstack/react-router";
import { Home, Zap, Stamp, Dices, User } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/drops", label: "Drops", icon: Zap },
  { to: "/passport", label: "Passport", icon: Stamp },
  { to: "/decide", label: "Decide", icon: Dices },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t bg-card/90 backdrop-blur-xl pb-safe">
      <ul className="grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: true }}
              className="group flex h-16 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <span className="grid h-8 w-14 place-items-center rounded-full transition-all group-data-[status=active]:bg-primary-soft group-active:scale-90">
                <Icon className="size-[22px]" strokeWidth={2.2} />
              </span>
              <span className="text-[11px] font-semibold">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
