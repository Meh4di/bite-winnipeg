import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

export type HeroSlide = {
  key: string;
  eyebrow: string;
  title: string;
  sub: string;
  image: string | null;
  emoji: string;
  tone: "red" | "green" | "blue" | "dark";
  to: "/drops" | "/crawls" | "/best" | "/map" | "/for-restaurants";
  search?: { tab?: "drops" | "leftover" | "vortex" };
};

const TONE: Record<HeroSlide["tone"], string> = {
  red: "from-[oklch(0.45_0.2_28/0.92)] via-[oklch(0.45_0.2_28/0.55)]",
  green: "from-[oklch(0.38_0.12_150/0.92)] via-[oklch(0.38_0.12_150/0.5)]",
  blue: "from-[oklch(0.38_0.15_250/0.92)] via-[oklch(0.38_0.15_250/0.5)]",
  dark: "from-black/90 via-black/45",
};

/** Big auto-advancing banner carousel, swipeable, like the top of Uber Eats. */
export function HomeHero({ slides }: { slides: HeroSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (slides.length < 2) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => {
      if (paused.current || !track.current) return;
      const next = (i + 1) % slides.length;
      track.current.scrollTo({ left: next * track.current.clientWidth, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(t);
  }, [i, slides.length]);

  if (!slides.length) return null;
  return (
    <div className="relative mt-4">
      <div
        ref={track}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        onPointerDown={() => (paused.current = true)}
        onPointerUp={() => setTimeout(() => (paused.current = false), 4000)}
      >
        {slides.map((s) => (
          <Link
            key={s.key}
            to={s.to}
            search={s.search ?? {}}
            className="w-full shrink-0 snap-center px-5"
          >
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-warm shadow-pop">
              {s.image ? (
                <img src={s.image} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="absolute -right-4 -top-6 text-[9rem] opacity-30">{s.emoji}</span>
              )}
              <div className={`absolute inset-0 bg-gradient-to-t ${TONE[s.tone]} to-transparent`} />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <span className="inline-block rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur">
                  {s.eyebrow}
                </span>
                <p className="mt-2 text-[26px] font-extrabold leading-[1.05] tracking-tight">
                  {s.title}
                </p>
                <p className="mt-1 text-sm font-medium opacity-90">{s.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5" aria-hidden>
          {slides.map((s, n) => (
            <span
              key={s.key}
              className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-foreground" : "w-1.5 bg-border"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
