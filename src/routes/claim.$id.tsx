import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { displayAddress, emojiFor } from "@/lib/bite";
import { VerificationForm } from "@/components/bite/VerificationForm";

export const Route = createFileRoute("/claim/$id")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user)
      throw redirect({ to: "/auth", search: { redirect: `/claim/${params.id}`, as: "owner" } });
    return { userId: data.user.id };
  },
  head: () => ({
    meta: [
      { title: "Claim your restaurant — Bite" },
      {
        name: "description",
        content: "Own this restaurant? Claim it on Bite for free and start posting deals.",
      },
    ],
  }),
  component: Claim,
});

const PERKS = [
  "Free for your first 3 months after you're verified",
  "Keep 100% of your sales: no commission",
  "Post drops, Save food deals and Unlock deals",
  "Pickup orders, stamps for regulars, reviews you can reply to",
];

function Claim() {
  const { id } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();

  const spot = useQuery({
    queryKey: ["claim-spot", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select(
          "id, name, slug, category, neighbourhood, address, phone, verification_status, owner_id",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const mine = useQuery({
    queryKey: ["my-claim", id, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_verifications")
        .select("id, status, admin_note, created_at")
        .eq("restaurant_id", id)
        .eq("submitted_by", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const r = spot.data;
  const header = (
    <Link
      to={r ? "/r/$slug" : "/"}
      params={r ? { slug: r.slug } : {}}
      className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground"
    >
      <ArrowLeft className="size-4" /> Back
    </Link>
  );

  if (spot.isLoading || mine.isLoading)
    return <div className="m-5 h-60 animate-pulse rounded-3xl bg-muted" />;

  if (!r)
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
        {header}
        <p className="mt-16 text-center text-xl font-extrabold">We couldn't find this restaurant</p>
      </div>
    );

  const pending = mine.data?.status === "pending";
  const claimed = r.verification_status !== "unclaimed";

  return (
    <div className="mx-auto max-w-[430px] pb-16 pt-[max(env(safe-area-inset-top),1.25rem)] animate-screen">
      <div className="px-5">
        {header}
        <div className="mt-4 flex items-center gap-3 rounded-3xl bg-card p-4 shadow-card">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-3xl">
            {emojiFor(r.category)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold">{r.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {r.address ? displayAddress(r.address) : r.neighbourhood}
            </p>
          </div>
        </div>
      </div>

      {pending ? (
        <div className="mx-5 mt-5 rounded-3xl bg-foreground p-6 text-center text-background">
          <Clock className="mx-auto size-9 text-primary" />
          <p className="mt-2 text-xl font-extrabold">Your claim is in review</p>
          <p className="mt-1 text-sm opacity-80">
            We'll call the restaurant's listed number to confirm it's you. Usually 1 to 2 business
            days.
          </p>
          <Button asChild variant="secondary" className="mt-4 rounded-full">
            <Link to="/owner">Go to my business dashboard</Link>
          </Button>
        </div>
      ) : claimed ? (
        <div className="mx-5 mt-5 rounded-3xl bg-secondary p-6 text-center">
          <p className="text-lg font-extrabold">This restaurant is already on Bite</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If you run it and didn't set this up, report it from the restaurant's page and we'll
            sort it out.
          </p>
        </div>
      ) : (
        <>
          <div className="mx-5 mt-5 rounded-3xl bg-primary-soft p-5">
            <p className="text-lg font-extrabold text-primary">Run {r.name}? It's free to claim.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {PERKS.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {p}
                </li>
              ))}
            </ul>
          </div>
          {mine.data?.status === "rejected" && mine.data.admin_note && (
            <p className="mx-5 mt-4 rounded-2xl bg-destructive/10 p-3 text-sm">
              Last time we couldn't confirm it: “{mine.data.admin_note}”
            </p>
          )}
          <VerificationForm
            userId={userId}
            restaurant={{ id: r.id, name: r.name, phone: r.phone }}
            title="Prove it's yours"
            intro="So nobody can take over your listing or post deals in your name. Only the Bite team sees this."
            onDone={() => navigate({ to: "/owner" })}
          />
        </>
      )}
    </div>
  );
}
