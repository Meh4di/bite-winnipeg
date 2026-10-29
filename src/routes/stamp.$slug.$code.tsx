import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/stamp/$slug/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Collect your stamp — Bite" },
      { name: "description", content: "Collect a Bite Passport stamp." },
      { property: "og:title", content: "Collect your stamp — Bite" },
      { property: "og:description", content: "Collect a Bite Passport stamp." },
    ],
  }),
  component: StampClaim,
});

function StampClaim() {
  const { slug, code } = Route.useParams();
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState<
    { ok: true; name: string } | { ok: false; error: string } | null
  >(null);
  const tried = useRef(false);

  useEffect(() => {
    if (loading || !user || tried.current) return;
    tried.current = true;
    supabase.rpc("claim_visit_stamp", { p_slug: slug, p_code: code }).then(({ data, error }) => {
      if (error) setState({ ok: false, error: error.message });
      else {
        setState({ ok: true, name: data?.[0]?.restaurant_name ?? "this spot" });
        qc.invalidateQueries({ queryKey: ["passport"] });
      }
    });
  }, [loading, user, slug, code, qc]);

  if (!loading && !user)
    return (
      <Shell
        emoji="🍁"
        title="Sign in to collect your stamp"
        line="It takes a few seconds. We'll bring you right back."
      >
        <Button asChild size="xl" className="w-full">
          <Link to="/auth" search={{ redirect: `/stamp/${slug}/${code}` }}>
            Sign in or create account
          </Link>
        </Button>
      </Shell>
    );

  if (!state) return <Shell emoji="⏳" title="Stamping…" line="One sec." />;

  if (!state.ok)
    return (
      <Shell emoji="😕" title="No stamp this time" line={state.error}>
        <Button asChild size="xl" className="w-full">
          <Link to="/passport">Open my Passport</Link>
        </Button>
      </Shell>
    );

  return (
    <Shell emoji="🍁" title="Stamped!" line={`You collected a stamp at ${state.name}.`} celebrate>
      <Button asChild size="xl" className="w-full">
        <Link to="/passport">See my Passport</Link>
      </Button>
      <Button asChild variant="ghost" className="w-full">
        <Link to="/r/$slug" params={{ slug }}>
          Back to {state.name}
        </Link>
      </Button>
    </Shell>
  );
}

function Shell({
  emoji,
  title,
  line,
  children,
  celebrate,
}: {
  emoji: string;
  title: string;
  line: string;
  children?: React.ReactNode;
  celebrate?: boolean;
}) {
  return (
    <div className="flex min-h-[90dvh] flex-col items-center justify-center px-8 text-center animate-screen">
      <div
        className={`grid size-32 place-items-center rounded-[2.5rem] text-6xl ${celebrate ? "bg-warm shadow-pop animate-stamp" : "bg-card shadow-card"}`}
      >
        {emoji}
      </div>
      <h1 className="mt-6 text-3xl font-extrabold">{title}</h1>
      <p className="mt-2 max-w-xs text-muted-foreground">{line}</p>
      <div className="mt-8 w-full max-w-xs space-y-2">{children}</div>
    </div>
  );
}
