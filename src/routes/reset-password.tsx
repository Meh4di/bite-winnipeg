import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Where the "reset your password" email link lands. Supabase signs the person in from the link. */
export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Set a new password — Bity" }] }),
  component: ResetPassword,
});

const field =
  "h-14 w-full rounded-2xl border bg-card px-4 text-base outline-none focus:border-primary";

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    // If the link was already processed, there's a session now.
    void supabase.auth.getSession().then(({ data: d }) => {
      setReady((r) => r ?? !!d.session);
    });
    const t = window.setTimeout(() => setReady((r) => r ?? false), 4000);
    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(t);
    };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return void toast.error("Use at least 6 characters");
    if (pw !== pw2) return void toast.error("The two passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Password updated. You're signed in.");
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),3rem)]">
      <div className="flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="Bity" className="size-14 rounded-2xl shadow-pop" />
        <span className="font-display text-3xl font-extrabold">bity</span>
      </div>
      <h1 className="mt-8 text-4xl font-extrabold leading-[1.05]">Set a new password.</h1>
      {ready === false ? (
        <div className="mt-6 space-y-4">
          <p className="text-muted-foreground">
            This reset link has expired or was already used. Ask for a new one from the sign-in
            page.
          </p>
          <Button size="xl" className="w-full" onClick={() => navigate({ to: "/auth" })}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={save} className="mt-8 space-y-3">
          <input
            className={field}
            type="password"
            placeholder="New password"
            autoComplete="new-password"
            minLength={6}
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <input
            className={field}
            type="password"
            placeholder="Type it again"
            autoComplete="new-password"
            minLength={6}
            required
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
          <Button type="submit" size="xl" className="w-full" disabled={busy || !ready}>
            {busy ? "Saving…" : ready ? "Save new password" : "Checking your link…"}
          </Button>
        </form>
      )}
    </div>
  );
}
