import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CATEGORIES, DAYS, NEIGHBOURHOODS, slugify, type Hours } from "@/lib/bite";
import { ImagePick } from "@/components/bite/ImagePick";
import { Route as OwnerRoute, useMyRestaurant } from "./owner";

const PinPicker = lazy(() => import("@/components/bite/PinPicker"));

export const Route = createFileRoute("/owner/setup")({ component: Setup });

const field = "h-12 w-full rounded-2xl border bg-card px-4 text-base outline-none focus:border-primary";
const defaultHours: Hours = Object.fromEntries(DAYS.map((d) => [d.key, { open: "09:00", close: "17:00" }]));

function Setup() {
  const { userId } = OwnerRoute.useRouteContext();
  const { data: r } = useMyRestaurant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState({
    name: "", category: "Coffee", description: "", address: "", neighbourhood: NEIGHBOURHOODS[0], phone: "",
    logo_url: null as string | null, cover_url: null as string | null, hours: defaultHours,
    lat: null as number | null, lng: null as number | null,
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (r)
      setF({
        name: r.name, category: r.category, description: r.description ?? "", address: r.address ?? "",
        neighbourhood: r.neighbourhood ?? NEIGHBOURHOODS[0], phone: r.phone ?? "",
        logo_url: r.logo_url, cover_url: r.cover_url, hours: { ...defaultHours, ...(r.hours as Hours) },
        lat: r.lat, lng: r.lng,
      });
  }, [r]);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const setDay = (k: string, v: Record<string, unknown>) =>
    setF((p) => ({ ...p, hours: { ...p.hours, [k]: { ...p.hours[k as keyof Hours], ...v } } }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = { ...f, neighbourhood: f.neighbourhood ?? null, hours: f.hours as never };
    const { error } = r
      ? await supabase.from("restaurants").update(payload).eq("id", r.id)
      : await supabase.from("restaurants").insert({
          ...payload, owner_id: userId, slug: `${slugify(f.name)}-${Math.random().toString(36).slice(2, 6)}`,
        });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved!");
    await qc.invalidateQueries({ queryKey: ["my-restaurant"] });
    qc.invalidateQueries({ queryKey: ["restaurants"] });
    navigate({ to: "/owner" });
  };

  return (
    <form onSubmit={save} className="space-y-4 px-5 pt-5 animate-screen">
      <h1 className="text-2xl font-extrabold">{r ? "Restaurant details" : "Set up your restaurant"}</h1>
      {!r && (
        <p className="rounded-2xl bg-primary-soft p-4 text-sm font-semibold text-primary">
          🍁 Founding partner offer: Bite is free for your first 3 months. No fees on orders, drops, deals or promotions.
        </p>
      )}
      <ImagePick bucket="restaurant-covers" userId={userId} value={f.cover_url} onChange={(u) => set("cover_url", u)} label="Cover photo" className="h-40 w-full" />
      <ImagePick bucket="restaurant-logos" userId={userId} value={f.logo_url} onChange={(u) => set("logo_url", u)} label="Logo" className="size-24" />
      <input className={field} placeholder="Restaurant name" required value={f.name} onChange={(e) => set("name", e.target.value)} />
      <select className={field} value={f.category} onChange={(e) => set("category", e.target.value)}>
        {CATEGORIES.map((c) => <option key={c.name}>{c.name}</option>)}
      </select>
      <textarea className={`${field} h-24 py-3`} placeholder="Description" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <input className={field} placeholder="Street address" value={f.address} onChange={(e) => set("address", e.target.value)} />
      <Suspense fallback={<div className="h-60 animate-pulse rounded-2xl bg-muted" />}>
        <PinPicker address={f.address} lat={f.lat} lng={f.lng} onChange={(lat, lng) => setF((p) => ({ ...p, lat, lng }))} />
      </Suspense>
      <select className={field} value={f.neighbourhood} onChange={(e) => set("neighbourhood", e.target.value)}>
        {NEIGHBOURHOODS.map((n) => <option key={n}>{n}</option>)}
      </select>
      <input className={field} type="tel" placeholder="Phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
      <h2 className="pt-2 text-lg font-bold">Hours</h2>
      <div className="space-y-2 rounded-3xl bg-card p-4 shadow-card">
        {DAYS.map((d) => {
          const h = f.hours[d.key] ?? {};
          return (
            <div key={d.key} className="flex items-center gap-2 text-sm">
              <span className="w-10 font-semibold">{d.label.slice(0, 3)}</span>
              <input type="time" disabled={h.closed} value={h.open ?? ""} onChange={(e) => setDay(d.key, { open: e.target.value })} className="h-10 flex-1 rounded-xl border bg-background px-2 disabled:opacity-40" />
              <input type="time" disabled={h.closed} value={h.close ?? ""} onChange={(e) => setDay(d.key, { close: e.target.value })} className="h-10 flex-1 rounded-xl border bg-background px-2 disabled:opacity-40" />
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={!!h.closed} onChange={(e) => setDay(d.key, { closed: e.target.checked })} /> Closed
              </label>
            </div>
          );
        })}
      </div>
      <Button type="submit" size="xl" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
    </form>
  );
}
