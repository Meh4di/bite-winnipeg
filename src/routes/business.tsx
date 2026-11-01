import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchRole } from "@/lib/auth";

/** Short link for owners: bity…/business opens Bity Business (dashboard) or the sign-up page. */
export const Route = createFileRoute("/business")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user && (await fetchRole(data.user.id)) === "restaurant_owner")
      throw redirect({ to: "/owner" });
    throw redirect({ to: "/for-restaurants" });
  },
});
