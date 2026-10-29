import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchRole, useAuth, type BiteRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const r = search["redirect"];
    const ok =
      typeof r === "string" &&
      /^\/(checkout|drops|passport|decide(\/[A-Za-z0-9]{5})?|stamp\/[a-z0-9-]+\/[A-Za-z0-9]{6}|orders\/[a-f0-9-]+)$/.test(r);
    return ok ? { redirect: r } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — Bite" },
      { name: "description", content: "Sign in or create your Bite account as a foodie or restaurant owner." },
      { property: "og:title", content: "Sign in — Bite" },
      { property: "og:description", content: "Join Bite, Winnipeg's food app." },
    ],
  }),
  component: AuthPage,
});

const field =
  "h-13 w-full rounded-2xl border bg-card px-4 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";

function AuthPage() {
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<BiteRole>("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const { user, role: currentRole, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && currentRole)
      navigate({ to: redirect ?? (currentRole === "restaurant_owner" ? "/owner" : "/"), replace: true });
  }, [loading, user, currentRole, navigate, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name, role } },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const r = await fetchRole(data.user.id);
        navigate({ to: redirect ?? (r === "restaurant_owner" ? "/owner" : "/"), replace: true });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center animate-screen">
        <p className="text-6xl">📬</p>
        <h1 className="mt-4 text-3xl font-extrabold">Check your inbox</h1>
        <p className="mt-2 text-muted-foreground">
          We sent a confirmation link to <b>{email}</b>. Tap it to finish creating your account.
        </p>
        <Button variant="ghost" className="mt-6" onClick={() => { setSent(false); setMode("signin"); }}>
          Back to sign in
        </Button>
      </div>
    );

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),3rem)] animate-screen">
      <div className="flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="Bite" className="size-14 rounded-2xl shadow-pop" />
        <span className="font-display text-3xl font-extrabold">bite</span>
      </div>
      <h1 className="mt-8 text-4xl font-extrabold leading-[1.05]">
        {mode === "signin" ? "Welcome back." : "Winnipeg's tastiest app."}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {mode === "signin" ? "Sign in to keep biting." : "Create an account in seconds."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        {mode === "signup" && (
          <>
            <p className="text-sm font-semibold">I am a…</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["customer", "😋", "Foodie", "Find & order food"],
                  ["restaurant_owner", "👩‍🍳", "Restaurant", "List my spot"],
                ] as const
              ).map(([value, emoji, title, sub]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setRole(value)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all active:scale-95 ${
                    role === value ? "border-primary bg-primary-soft" : "border-border bg-card"
                  }`}
                >
                  <span className="text-3xl">{emoji}</span>
                  <p className="mt-2 font-bold">{title}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </button>
              ))}
            </div>
            <input className={field} placeholder="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
          </>
        )}
        <input className={field} type="email" placeholder="Email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className={field}
          type="password"
          placeholder="Password"
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" size="xl" className="w-full" disabled={busy}>
          {busy ? "One sec…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-6 h-12 text-sm font-semibold text-primary"
      >
        {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
      <button onClick={() => navigate({ to: "/" })} className="h-12 text-sm text-muted-foreground">
        Just browsing →
      </button>
    </div>
  );
}
