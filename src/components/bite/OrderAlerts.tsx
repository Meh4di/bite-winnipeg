import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PREF = "bity-order-alerts";
const readPref = () => {
  try {
    return localStorage.getItem(PREF) === "on";
  } catch {
    return false;
  }
};
const writePref = (on: boolean) => {
  try {
    localStorage.setItem(PREF, on ? "on" : "off");
  } catch {
    /* private mode */
  }
};

type WakeLock = { release: () => Promise<void> };

/**
 * Kitchen-proof new-order alerts for Bity Business: a loud chime that repeats until someone taps,
 * vibration, a flashing tab title and a full-width banner, on every owner screen.
 * Browsers only allow sound after a tap, so owners switch alerts on once per session.
 */
export function OrderAlerts({ restaurantId }: { restaurantId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ctx = useRef<AudioContext | null>(null);
  const wake = useRef<WakeLock | null>(null);
  const [wanted, setWanted] = useState(false); // owner chose alerts before (needs a tap to re-arm)
  const [armed, setArmed] = useState(false); // sound is unlocked right now
  const [awake, setAwake] = useState(false);
  const [ringing, setRinging] = useState(0); // how many new orders waiting to be seen

  useEffect(() => setWanted(readPref()), []);

  const chime = useCallback(() => {
    const c = ctx.current;
    if (!c || c.state !== "running") return;
    // Three rising tones, loud enough to hear over a kitchen.
    [880, 1175, 1568].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "square";
      o.connect(g);
      g.connect(c.destination);
      const t = c.currentTime + i * 0.18;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.start(t);
      o.stop(t + 0.17);
    });
  }, []);

  const keepAwake = useCallback(async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (t: "screen") => Promise<WakeLock> };
      };
      if (!nav.wakeLock) return false;
      wake.current = await nav.wakeLock.request("screen");
      setAwake(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const arm = async () => {
    try {
      if (!ctx.current) ctx.current = new AudioContext();
      await ctx.current.resume();
      setArmed(true);
      setWanted(true);
      writePref(true);
      chime();
      navigator.vibrate?.(200);
      await keepAwake();
    } catch {
      setArmed(false);
    }
  };

  const off = async () => {
    await ctx.current?.suspend();
    await wake.current?.release().catch(() => {});
    wake.current = null;
    setArmed(false);
    setAwake(false);
    setWanted(false);
    writePref(false);
  };

  // Re-take the screen wake lock when the app comes back to the front.
  useEffect(() => {
    if (!armed) return;
    const onVis = () => {
      if (document.visibilityState === "visible" && !wake.current) void keepAwake();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [armed, keepAwake]);

  useEffect(
    () => () => {
      void ctx.current?.close();
      void wake.current?.release().catch(() => {});
    },
    [],
  );

  // Listen for new paid orders (pickup orders and claimed drops) on every owner screen.
  useEffect(() => {
    const channel = supabase
      .channel(`order-alerts-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if (payload.new["status"] !== "paid") return;
          setRinging((n) => n + 1);
          qc.invalidateQueries({ queryKey: ["orders"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, qc]);

  // While orders are waiting: ring every 3 s (for up to 2 minutes), buzz, flash the title.
  useEffect(() => {
    if (!ringing) return;
    const title = document.title;
    let tick = 0;
    const loop = () => {
      chime();
      navigator.vibrate?.([300, 120, 300, 120, 600]);
    };
    loop();
    const ring = setInterval(() => {
      tick += 1;
      if (tick <= 40) loop();
    }, 3000);
    const flash = setInterval(() => {
      document.title = document.title.startsWith("🔔") ? title : `🔔 New order! (${ringing})`;
    }, 900);
    return () => {
      clearInterval(ring);
      clearInterval(flash);
      document.title = title;
    };
  }, [ringing, chime]);

  const see = () => {
    setRinging(0);
    navigate({ to: "/owner" });
  };

  if (ringing > 0)
    return (
      <button
        onClick={see}
        className="fixed inset-x-0 top-0 z-[2000] mx-auto flex max-w-[430px] animate-pulse items-center justify-center gap-3 bg-primary px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] text-primary-foreground shadow-pop"
      >
        <BellRing className="size-7" />
        <span className="text-left">
          <span className="block text-lg font-extrabold leading-tight">
            {ringing === 1 ? "New order!" : `${ringing} new orders!`}
          </span>
          <span className="block text-sm opacity-90">Tap to see it and stop the alert</span>
        </span>
      </button>
    );

  if (!armed)
    return (
      <button
        onClick={arm}
        className="mx-5 mt-3 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-2xl bg-amber-100 p-3 text-left text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <BellRing className="size-6 shrink-0" />
        <span>
          <span className="block text-sm font-extrabold">
            {wanted ? "Tap to switch order alerts back on" : "Turn on loud order alerts"}
          </span>
          <span className="block text-xs opacity-80">
            Rings and buzzes until you tap, and keeps the screen on. Keep Bity Business open at the
            counter.
          </span>
        </span>
      </button>
    );

  return (
    <div className="mx-5 mt-3 flex items-center justify-between gap-2 rounded-2xl bg-success/10 px-3 py-2 text-xs font-bold text-success">
      <span className="flex items-center gap-1.5">
        <BellRing className="size-4" /> Order alerts on
        {awake && (
          <>
            {" "}
            · <Sun className="size-3.5" /> screen stays on
          </>
        )}
      </span>
      <span className="flex gap-3">
        <button onClick={chime} className="underline">
          Test
        </button>
        <button onClick={off} className="underline">
          Turn off
        </button>
      </span>
    </div>
  );
}
