import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type BiteRole = "customer" | "restaurant_owner";

type AuthState = {
  session: Session | null;
  user: User | null;
  role: BiteRole | null;
  loading: boolean;
  refreshRole: () => Promise<BiteRole | null>;
};

const AuthCtx = createContext<AuthState>({
  session: null,
  user: null,
  role: null,
  loading: true,
  refreshRole: async () => null,
});

export async function fetchRole(userId: string): Promise<BiteRole> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return data?.some((r) => r.role === "restaurant_owner") ? "restaurant_owner" : "customer";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<BiteRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) {
      setRole(null);
      return;
    }
    setLoading(true);
    fetchRole(uid).then((r) => {
      setRole(r);
      setLoading(false);
    });
  }, [uid]);

  const refreshRole = async () => {
    if (!uid) return null;
    const r = await fetchRole(uid);
    setRole(r);
    return r;
  };

  return (
    <AuthCtx.Provider value={{ session, user: session?.user ?? null, role, loading, refreshRole }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
