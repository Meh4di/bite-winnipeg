import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export const isVerified = (r?: { verification_status: string } | null) =>
  r?.verification_status === "verified";

export function useLatestVerification(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ["verification", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_verifications")
        .select("id, status, admin_note, created_at, reviewed_at")
        .eq("restaurant_id", restaurantId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function VerifiedChip({ status }: { status: string }) {
  if (status === "verified")
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">
        <BadgeCheck className="size-3.5" /> Verified
      </span>
    );
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600">
        <Clock className="size-3.5" /> In review
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
      <ShieldAlert className="size-3.5" /> Not verified
    </span>
  );
}

const STEPS = [
  "Set up your page",
  "Prove it's your business",
  "We review (1–2 days)",
  "You're live",
];

/** Big status card at the top of the owner dashboard until the restaurant is verified. */
export function VerifyStatusCard({
  restaurant,
}: {
  restaurant: { id: string; verification_status: string };
}) {
  const latest = useLatestVerification(restaurant.id);
  const s = restaurant.verification_status as VerificationStatus;
  if (s === "verified") return null;
  const step = s === "pending" ? 2 : 1;

  return (
    <div className="overflow-hidden rounded-3xl bg-foreground text-background shadow-pop">
      <div className="p-5">
        <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-primary">
          <ShieldCheck className="size-4" /> Business verification
        </p>
        {s === "pending" ? (
          <>
            <p className="mt-2 text-2xl font-extrabold leading-tight">
              We're checking your business
            </p>
            <p className="mt-1 text-sm opacity-80">
              We'll call the phone number listed for your restaurant to confirm it's you. Most
              reviews take 1 to 2 business days. Meanwhile you can keep building your menu.
            </p>
          </>
        ) : s === "rejected" ? (
          <>
            <p className="mt-2 text-2xl font-extrabold leading-tight">We couldn't verify you yet</p>
            {latest.data?.admin_note && (
              <p className="mt-2 rounded-2xl bg-background/10 p-3 text-sm">
                “{latest.data.admin_note}”
              </p>
            )}
            <Button asChild size="lg" className="mt-4 w-full rounded-2xl">
              <Link to="/owner/verify">Fix and resubmit</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-2xl font-extrabold leading-tight">Get verified to go live</p>
            <p className="mt-1 text-sm opacity-80">
              Your page is private until we confirm you run this restaurant. That keeps fake
              listings off Bity and protects your name.
            </p>
            <Button asChild size="lg" className="mt-4 w-full rounded-2xl">
              <Link to="/owner/verify">Verify my business</Link>
            </Button>
          </>
        )}
      </div>
      <ol className="grid grid-cols-4 gap-1 border-t border-background/15 px-3 py-3">
        {STEPS.map((t, i) => (
          <li key={t} className="text-center">
            <span
              className={`mx-auto grid size-7 place-items-center rounded-full text-xs font-extrabold ${
                i < step
                  ? "bg-success text-white"
                  : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/15"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className="mt-1 block text-[10px] font-semibold leading-tight opacity-80">
              {t}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Shown instead of a business tool until the restaurant is verified. */
export function LockedTool({ title, status }: { title: string; status: string }) {
  return (
    <div className="flex flex-col items-center px-8 pt-16 text-center animate-screen">
      <span className="grid size-20 place-items-center rounded-full bg-secondary">
        <Lock className="size-9 text-muted-foreground" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold">{title} unlock after verification</h1>
      <p className="mt-2 text-muted-foreground">
        {status === "pending"
          ? "We're reviewing your business now. You'll get these tools as soon as you're approved."
          : "Prove you run this restaurant and you'll get drops, deals, stamps and pickup orders."}
      </p>
      {status !== "pending" && (
        <Button asChild size="xl" className="mt-6 w-full">
          <Link to="/owner/verify">Verify my business</Link>
        </Button>
      )}
    </div>
  );
}
