import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Route as OwnerRoute, useMyRestaurant } from "./owner";
import { VerifyStatusCard } from "@/components/bite/Verification";
import { VerificationForm } from "@/components/bite/VerificationForm";

export const Route = createFileRoute("/owner/verify")({ component: Verify });

function Verify() {
  const { userId } = OwnerRoute.useRouteContext();
  const { data: r, isLoading } = useMyRestaurant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  if (isLoading) return <div className="m-5 h-40 animate-pulse rounded-3xl bg-muted" />;
  if (!r)
    return (
      <div className="px-6 pt-12 text-center">
        <p className="text-5xl">🏪</p>
        <h1 className="mt-3 text-2xl font-extrabold">Set up your page first</h1>
        <p className="mt-2 text-muted-foreground">
          Add your restaurant's name and address, then verify.
        </p>
        <Button asChild size="xl" className="mt-6 w-full">
          <Link to="/owner/setup">Set up my restaurant</Link>
        </Button>
      </div>
    );
  if (r.verification_status === "verified" || r.verification_status === "pending")
    return (
      <div className="px-5 pt-5">
        {r.verification_status === "verified" ? (
          <div className="rounded-3xl bg-success/15 p-6 text-center">
            <ShieldCheck className="mx-auto size-10 text-success" />
            <p className="mt-2 text-xl font-extrabold">{r.name} is verified</p>
            <p className="text-sm text-muted-foreground">All business tools are unlocked.</p>
          </div>
        ) : (
          <VerifyStatusCard restaurant={r} />
        )}
      </div>
    );

  return (
    <VerificationForm
      userId={userId}
      restaurant={r}
      title={`Verify ${r.name}`}
      intro="This keeps fake restaurants off Bity and makes sure nobody else can post deals in your name. Only the Bity team sees this."
      onDone={async () => {
        await qc.invalidateQueries({ queryKey: ["my-restaurant"] });
        qc.invalidateQueries({ queryKey: ["verification"] });
        navigate({ to: "/owner" });
      }}
    />
  );
}
