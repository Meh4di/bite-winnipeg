import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/for-restaurants")({
  head: () => ({
    meta: [
      { title: "Bite for restaurants — free for 3 months" },
      {
        name: "description",
        content:
          "List your Winnipeg restaurant or cafe on Bite. Pickup orders, drops, Save food deals and promos with no fees for your first 3 months.",
      },
      { property: "og:title", content: "Bite for restaurants" },
      {
        property: "og:description",
        content: "Free for your first 3 months. No fees on orders or deals.",
      },
    ],
  }),
  component: ForRestaurants,
});

const STEPS = [
  {
    n: 1,
    title: "Create a restaurant account",
    line: "Pick “Restaurant” when you sign up. Takes 30 seconds.",
  },
  {
    n: 2,
    title: "Set up your page",
    line: "Add your logo, photos, hours, address and menu, and drop your pin on the map.",
  },
  {
    n: 3,
    title: "Go live",
    line: "Turn on pickup orders and post your first drop, Save food deal or promo.",
  },
  {
    n: 4,
    title: "Grow",
    line: "Watch orders, reviews, stamps and repeat customers in your dashboard.",
  },
];

const FEATURES = [
  {
    e: "🛍️",
    t: "Pickup pre-orders",
    d: "Customers order ahead and pay in the app. You get a live kitchen screen.",
  },
  { e: "🔥", t: "Drops", d: "Limited items at a set time. Builds hype and fills slow hours." },
  { e: "♻️", t: "Save food", d: "Sell end-of-day food at 60–70% off instead of throwing it out." },
  {
    e: "🥶",
    t: "Polar Vortex deals",
    d: "Specials that unlock automatically when Winnipeg hits -25°C.",
  },
  {
    e: "⭐",
    t: "House special",
    d: "Feature the dish you're proudest of on your page and the map.",
  },
  {
    e: "🍁",
    t: "Passport stamps",
    d: "A QR code at your counter. Every 5 stamps earns a regular a reward.",
  },
  {
    e: "🟢",
    t: "Live busy & wait",
    d: "One tap tells people how busy you are and how long the wait is.",
  },
  {
    e: "💬",
    t: "Verified reviews",
    d: "Only real customers can review, and you can reply to every one.",
  },
];

const FAQ = [
  {
    q: "How do customers pay?",
    a: "In the app, by card, Apple Pay or Google Pay, when they place a pickup order or claim a drop. Right now Bite is in test mode, so no real money moves yet.",
  },
  {
    q: "How do I get paid?",
    a: "Once payments go live, you'll connect a payout account in your dashboard and order money is sent straight to your bank. Bite never holds your menu prices.",
  },
  {
    q: "What does it cost?",
    a: "Nothing for your first 3 months: no fees on orders, drops, Save food deals or promotions. We'll tell you the pricing well before your free period ends, and you can leave any time.",
  },
  {
    q: "Do you do delivery?",
    a: "Pickup only for now. Delivery is on the roadmap.",
  },
];

function ForRestaurants() {
  const { user, role } = useAuth();
  const isOwner = !!user && role === "restaurant_owner";
  const cta = isOwner ? (
    <Button asChild size="xl" className="w-full">
      <Link to="/owner">Go to my dashboard</Link>
    </Button>
  ) : (
    <Button asChild size="xl" className="w-full">
      <Link to="/auth" search={{ as: "owner" }}>
        List my restaurant, free
      </Link>
    </Button>
  );

  return (
    <div className="animate-screen pb-16">
      <section className="relative overflow-hidden bg-foreground px-5 pb-8 pt-[max(env(safe-area-inset-top),1rem)] text-background">
        <span className="pointer-events-none absolute -right-8 top-8 text-[10rem] opacity-15">
          🍁
        </span>
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold opacity-80">
          <ArrowLeft className="size-4" /> Bite
        </Link>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-widest text-primary">
          For restaurants & cafes
        </p>
        <h1 className="mt-2 text-[2.25rem] font-extrabold leading-[1.05]">
          More customers. Less waste. <span className="text-primary">Zero fees</span> for 3 months.
        </h1>
        <p className="mt-3 text-[15px] opacity-80">
          Bite is Winnipeg's food app for pickup orders, hype drops and rescuing end-of-day food.
        </p>
        <div className="mt-6">{cta}</div>
      </section>

      <section className="px-5 pt-8">
        <h2 className="text-2xl font-extrabold">How it works</h2>
        <ol className="mt-4 space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4 rounded-2xl bg-secondary p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-lg font-extrabold text-primary-foreground">
                {s.n}
              </span>
              <div>
                <p className="font-bold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.line}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-5 pt-8">
        <h2 className="text-2xl font-extrabold">What you get</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-2xl bg-card p-4 shadow-card">
              <p className="text-3xl">{f.e}</p>
              <p className="mt-2 font-bold leading-tight">{f.t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pt-8">
        <div className="rounded-3xl bg-primary-soft p-5">
          <p className="text-lg font-extrabold text-primary">🍁 Founding partner offer</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              "No fees on anything for 3 months",
              "No contract, leave any time",
              "Set up in about 10 minutes",
              "We'll help you post your first drop",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 text-primary" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-5 pt-8">
        <h2 className="text-2xl font-extrabold">Questions</h2>
        <div className="mt-3 divide-y rounded-2xl bg-card shadow-card">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
                {f.q}
                <span className="text-xl text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="px-5 pt-8">{cta}</div>
    </div>
  );
}
