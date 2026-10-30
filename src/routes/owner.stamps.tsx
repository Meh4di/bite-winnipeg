import { createFileRoute, Link } from "@tanstack/react-router";
import { LockedTool, isVerified } from "@/components/bite/Verification";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Maximize2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { countdown, useNow } from "@/lib/live";
import { useMyRestaurant } from "./owner";

export const Route = createFileRoute("/owner/stamps")({
  head: () => ({
    meta: [
      { title: "Stamp code — Bite Business" },
      {
        name: "description",
        content: "Show this code at your counter so customers can collect passport stamps.",
      },
      { property: "og:title", content: "Stamp code — Bite Business" },
      { property: "og:description", content: "Your counter stamp code." },
    ],
  }),
  component: Gated,
});

function StampCode() {
  const { data: r } = useMyRestaurant();
  const now = useNow(1000);
  const [qr, setQr] = useState<string | null>(null);
  const [big, setBig] = useState(false);

  const code = useQuery({
    queryKey: ["stamp-code", r?.id],
    enabled: !!r,
    refetchInterval: (q) => {
      const exp = q.state.data?.expires_at;
      return exp ? Math.max(1000, new Date(exp).getTime() - Date.now() + 500) : 10_000;
    },
    queryFn: async () => {
      if (!r) return null;
      const { data, error } = await supabase.rpc("get_stamp_code", { p_restaurant_id: r.id });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const url = r && code.data ? `${window.location.origin}/stamp/${r.slug}/${code.data.code}` : null;
  useEffect(() => {
    if (!url) return;
    let alive = true;
    QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: "#1f1414", light: "#ffffff" } })
      .then((d) => alive && setQr(d))
      .catch(() => setQr(null));
    return () => {
      alive = false;
    };
  }, [url]);

  const stats = useQuery({
    queryKey: ["owner-stamp-stats", r?.id],
    enabled: !!r,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!r) return { today: 0, total: 0 };
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const [today, total] = await Promise.all([
        supabase
          .from("stamps")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", r.id)
          .gte("created_at", start.toISOString()),
        supabase
          .from("stamps")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", r.id),
      ]);
      return { today: today.count ?? 0, total: total.count ?? 0 };
    },
  });

  if (!r)
    return (
      <div className="p-8 text-center">
        <p>Set up your restaurant first.</p>
        <Link to="/owner/setup" className="font-semibold text-primary">
          Go to setup
        </Link>
      </div>
    );

  const left = code.data ? new Date(code.data.expires_at).getTime() - now : 0;

  const card = (
    <div className="flex flex-col items-center rounded-3xl bg-card p-6 text-center shadow-card">
      <p className="text-sm font-bold uppercase tracking-wider text-primary">🍁 Bite Passport</p>
      <h2 className="mt-1 text-2xl font-extrabold">Scan for a stamp</h2>
      <div className="mt-4 aspect-square w-full max-w-[320px] rounded-2xl bg-white p-3">
        {qr ? (
          <img src={qr} alt="Stamp QR code" className="size-full" />
        ) : (
          <div className="size-full animate-pulse rounded-xl bg-muted" />
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Or enter this code in the Passport tab</p>
      <p className="font-mono text-4xl font-extrabold tracking-[0.3em]">
        {code.data?.code ?? "······"}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">New code in {countdown(left)}</p>
    </div>
  );

  if (big)
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-6">
        <button
          aria-label="Close"
          onClick={() => setBig(false)}
          className="absolute right-4 top-4 grid size-12 place-items-center rounded-full bg-card shadow-card"
        >
          <X className="size-6" />
        </button>
        <div className="w-full max-w-[420px]">{card}</div>
      </div>
    );

  return (
    <div className="space-y-4 px-5 pt-5 animate-screen">
      <div>
        <h1 className="text-2xl font-extrabold">Stamp code</h1>
        <p className="text-sm text-muted-foreground">
          Put this on a tablet at your counter. Customers scan it with their phone camera to collect
          a passport stamp. It changes every 2 minutes so it can't be shared online.
        </p>
      </div>
      {card}
      <Button size="xl" variant="secondary" className="w-full" onClick={() => setBig(true)}>
        <Maximize2 className="size-5" /> Full screen for the counter
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-card p-4 shadow-card">
          <p className="font-display text-3xl font-extrabold text-primary">
            {stats.data?.today ?? "–"}
          </p>
          <p className="text-sm text-muted-foreground">Stamps today</p>
        </div>
        <div className="rounded-3xl bg-card p-4 shadow-card">
          <p className="font-display text-3xl font-extrabold text-primary">
            {stats.data?.total ?? "–"}
          </p>
          <p className="text-sm text-muted-foreground">All-time stamps</p>
        </div>
      </div>
      <p className="rounded-2xl bg-primary-soft p-4 text-sm text-primary">
        <b>Rewards:</b> every 5 stamps at your spot earns a customer one reward. When they tap
        Redeem, their screen shows a big confirmation. Honour it with something small, like a free
        drip coffee or cookie.
      </p>
    </div>
  );
}

function Gated() {
  const { data: r, isLoading } = useMyRestaurant();
  if (isLoading) return <div className="m-5 h-40 animate-pulse rounded-3xl bg-muted" />;
  if (r && !isVerified(r)) return <LockedTool title="Passport stamps" status={r.verification_status} />;
  return <StampCode />;
}
